import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { RewardService } from '../../../core/services/reward.service';
import { LoggerService } from '../../../core/services/logger.service';
import { RewardStatus } from '../../../core/enums/referral-reward.enum';

/** Statuses that mean "already revealed" — the amount is known and stored,
 *  no scratch surface is shown regardless of how this instance got here. */
const REVEALED_STATUSES: ReadonlySet<RewardStatus> = new Set([
  RewardStatus.Revealed,
  RewardStatus.PayoutRequested,
  RewardStatus.Processing,
  RewardStatus.Paid,
  RewardStatus.Failed,
  RewardStatus.Cancelled,
]);

const STATUS_LABELS: Record<string, string> = {
  [RewardStatus.Revealed]: 'Reward earned',
  [RewardStatus.PayoutRequested]: 'Payout requested',
  [RewardStatus.Processing]: 'Payout processing',
  [RewardStatus.Paid]: 'Paid',
  [RewardStatus.Failed]: 'Payout failed',
  [RewardStatus.Cancelled]: 'Cancelled',
};

/** Low-res canvas used only to cheaply estimate scratched area — sampling a
 *  40x40 grid (1,600 pixels) is far cheaper than reading back the visible,
 *  device-pixel-ratio-scaled canvas on every pointer move. */
const MASK_SIZE = 40;

/**
 * Presents an eligible reward as a scratch-to-reveal card. Purely a UI
 * gesture: the amount shown always comes from the server (via
 * `RewardService.revealReward()`), never computed or guessed here. A
 * reward already past `ELIGIBLE` just displays its stored amount directly —
 * no canvas, no re-reveal.
 *
 * Always renders an accessible "Reveal reward" button alongside the canvas,
 * calling the exact same backend endpoint, so a user who can't perform the
 * scratch gesture (keyboard, screen reader, motor impairment) can still
 * reveal their reward.
 */
@Component({
  selector: 'tm-scratch-reward',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './scratch-reward.html',
  styleUrl: './scratch-reward.scss',
})
export class ScratchRewardComponent {
  readonly rewardId = input.required<string>();
  readonly status = input.required<RewardStatus>();
  /** Already-known amount for a reward that's past ELIGIBLE (e.g. loaded
   *  from `my_rewards`, which only ever returns one for a revealed row).
   *  `null` while still LOCKED/ELIGIBLE — never a guessed value. */
  readonly amount = input<number | null>(null);
  /** Fraction of the surface (0-1) that must be scratched clear before the
   *  reveal is triggered automatically. Configurable per instance. */
  readonly revealThreshold = input(0.6);
  readonly revealed = output<{ status: RewardStatus; amount: number | null }>();

  private readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('canvasEl');
  private readonly surfaceRef = viewChild<ElementRef<HTMLElement>>('surface');

  private readonly rewards = inject(RewardService);
  private readonly logger = inject(LoggerService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly override = signal<{ status: RewardStatus; amount: number | null } | null>(null);
  readonly localStatus = computed(() => this.override()?.status ?? this.status());
  readonly localAmount = computed(() => this.override()?.amount ?? this.amount());

  readonly revealing = signal(false);
  readonly errorMessage = signal('');
  readonly scratchProgress = signal(0);

  readonly isLocked = computed(() => this.localStatus() === RewardStatus.Locked);
  readonly isRevealedState = computed(() => REVEALED_STATUSES.has(this.localStatus()));
  readonly statusLabel = computed(() => STATUS_LABELS[this.localStatus()] ?? 'Reward');
  readonly formattedAmount = computed(() => {
    const amount = this.localAmount();
    if (amount === null) return '';
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(
      amount / 100,
    );
  });

  private ctx: CanvasRenderingContext2D | null = null;
  private maskCanvas: HTMLCanvasElement | null = null;
  private maskCtx: CanvasRenderingContext2D | null = null;
  private cssWidth = 0;
  private cssHeight = 0;
  private pointerActive = false;
  private lastPoint: { x: number; y: number } | null = null;
  private samplePending = false;
  private resizeObserver: ResizeObserver | null = null;
  private thresholdCrossed = false;

  constructor() {
    // Redraws the cover once the canvas becomes available for an eligible,
    // not-yet-revealed reward (the @if in the template only renders the
    // canvas in that case, so this waits for it to exist).
    effect(() => {
      if (this.isLocked() || this.isRevealedState()) return;
      const canvas = this.canvasRef()?.nativeElement;
      if (canvas && !this.ctx) this.setupCanvas(canvas);
    });

    this.destroyRef.onDestroy(() => {
      this.resizeObserver?.disconnect();
    });
  }

  private setupCanvas(canvas: HTMLCanvasElement): void {
    const surface = this.surfaceRef()?.nativeElement ?? canvas.parentElement;
    if (!surface) return;

    this.resizeObserver?.disconnect();
    this.resizeObserver = new ResizeObserver(() => this.resizeCanvas(canvas));
    this.resizeObserver.observe(surface);
    this.resizeCanvas(canvas);
  }

  private resizeCanvas(canvas: HTMLCanvasElement): void {
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    // Scratching in progress and the surface didn't actually change shape
    // (just a benign layout pass) — don't wipe what the user has already
    // scratched.
    if (this.ctx && rect.width === this.cssWidth && rect.height === this.cssHeight) return;

    this.cssWidth = rect.width;
    this.cssHeight = rect.height;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx = ctx;
    this.drawCover(ctx, rect.width, rect.height);

    if (!this.maskCanvas) {
      this.maskCanvas = document.createElement('canvas');
      this.maskCanvas.width = MASK_SIZE;
      this.maskCanvas.height = MASK_SIZE;
      this.maskCtx = this.maskCanvas.getContext('2d', { willReadFrequently: true });
    }
    if (this.maskCtx) {
      this.maskCtx.clearRect(0, 0, MASK_SIZE, MASK_SIZE);
      this.maskCtx.fillStyle = '#000';
      this.maskCtx.fillRect(0, 0, MASK_SIZE, MASK_SIZE);
    }
    this.scratchProgress.set(0);
    this.thresholdCrossed = false;
  }

  private drawCover(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.globalCompositeOperation = 'source-over';
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#c7d2fe');
    gradient.addColorStop(1, '#818cf8');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.font = `${Math.max(13, Math.min(width, height) * 0.11)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Scratch here', width / 2, height / 2);
  }

  onPointerDown(event: PointerEvent): void {
    if (this.revealing() || this.errorMessage()) return;
    this.pointerActive = true;
    this.lastPoint = null;
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
    this.scratchAt(event);
    event.preventDefault();
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.pointerActive) return;
    this.scratchAt(event);
    event.preventDefault();
  }

  onPointerUp(event: PointerEvent): void {
    this.pointerActive = false;
    this.lastPoint = null;
    event.preventDefault();
  }

  private scratchAt(event: PointerEvent): void {
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas || !this.ctx || !this.maskCtx || this.cssWidth === 0) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const brush = Math.max(18, Math.min(this.cssWidth, this.cssHeight) * 0.12);

    this.erase(this.ctx, x, y, brush, this.lastPoint);
    this.erase(
      this.maskCtx,
      (x / this.cssWidth) * MASK_SIZE,
      (y / this.cssHeight) * MASK_SIZE,
      (brush / this.cssWidth) * MASK_SIZE,
      this.lastPoint
        ? {
            x: (this.lastPoint.x / this.cssWidth) * MASK_SIZE,
            y: (this.lastPoint.y / this.cssHeight) * MASK_SIZE,
          }
        : null,
    );
    this.lastPoint = { x, y };

    if (!this.samplePending) {
      this.samplePending = true;
      requestAnimationFrame(() => {
        this.samplePending = false;
        this.updateScratchProgress();
      });
    }
  }

  private erase(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    brush: number,
    from: { x: number; y: number } | null,
  ): void {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(1, brush);
    ctx.beginPath();
    if (from) {
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(x, y);
    } else {
      ctx.moveTo(x, y);
      ctx.lineTo(x + 0.01, y + 0.01);
    }
    ctx.stroke();
  }

  private updateScratchProgress(): void {
    if (!this.maskCtx) return;
    const { data } = this.maskCtx.getImageData(0, 0, MASK_SIZE, MASK_SIZE);
    let cleared = 0;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] === 0) cleared++;
    }
    const ratio = cleared / (MASK_SIZE * MASK_SIZE);
    this.scratchProgress.set(ratio);

    if (!this.thresholdCrossed && ratio >= this.revealThreshold()) {
      this.thresholdCrossed = true;
      void this.reveal();
    }
  }

  /** Calls the secure reveal endpoint. Guarded against concurrent/duplicate
   *  calls, used by both the scratch threshold and the accessible button —
   *  a single code path, so neither can ever trigger two reveals. */
  async reveal(): Promise<void> {
    if (this.revealing() || this.isRevealedState() || this.isLocked()) return;

    this.revealing.set(true);
    this.errorMessage.set('');
    try {
      const result = await this.rewards.revealReward(this.rewardId());
      this.override.set({ status: result.status, amount: result.rewardAmount });
      this.clearCanvasFully();
      this.revealed.emit({ status: result.status, amount: result.rewardAmount });
    } catch (error) {
      this.logger.error('scratch-reward: reveal failed', error);
      const code = (error as { code?: string })?.code;
      this.errorMessage.set(
        code === 'not_found'
          ? "That reward couldn't be found. Please refresh and try again."
          : "Couldn't reveal your reward. Please try again.",
      );
    } finally {
      this.revealing.set(false);
    }
  }

  /** Once the server confirms the reveal, clear whatever's left of the
   *  cover so the amount is fully visible regardless of how much was
   *  physically scratched. */
  private clearCanvasFully(): void {
    if (this.ctx && this.cssWidth && this.cssHeight) {
      this.ctx.clearRect(0, 0, this.cssWidth, this.cssHeight);
    }
    // The template stops rendering the canvas/surface entirely once
    // isRevealedState() is true, so there's nothing left to observe.
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
  }
}
