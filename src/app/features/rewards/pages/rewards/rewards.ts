import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { RewardService } from '../../../../core/services/reward.service';
import { ReferralService } from '../../../../core/services/referral.service';
import { PayoutService } from '../../../../core/services/payout.service';
import { LoggerService } from '../../../../core/services/logger.service';
import { ToastService } from '../../../../core/services/toast.service';
import {
  Payout,
  PayoutDestination,
  ReferralProgramSettings,
  Reward,
  RewardSummary,
} from '../../../../core/models/referral-reward.model';
import { PayoutStatus, RewardStatus } from '../../../../core/enums/referral-reward.enum';
import { ScratchRewardComponent } from '../../../../shared/components/scratch-reward/scratch-reward';

const PAID_SECTION_STATUSES: ReadonlySet<RewardStatus> = new Set([
  RewardStatus.PayoutRequested,
  RewardStatus.Processing,
  RewardStatus.Paid,
  RewardStatus.Failed,
  RewardStatus.Cancelled,
]);

@Component({
  selector: 'app-rewards-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, RouterLink, ScratchRewardComponent],
  templateUrl: './rewards.html',
  styleUrl: './rewards.scss',
})
export class RewardsPage implements OnInit {
  private readonly rewardService = inject(RewardService);
  private readonly referral = inject(ReferralService);
  private readonly payout = inject(PayoutService);
  private readonly logger = inject(LoggerService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly loadError = signal('');
  readonly rewards = signal<Reward[]>([]);
  readonly summary = signal<RewardSummary | null>(null);
  readonly settings = signal<ReferralProgramSettings | null>(null);
  readonly destination = signal<PayoutDestination | null>(null);
  readonly payoutHistory = signal<Payout[]>([]);

  readonly upiInput = signal('');
  readonly savingDestination = signal(false);
  readonly showConfirm = signal(false);
  readonly requestingPayout = signal(false);
  readonly reconcilingId = signal<string | null>(null);

  readonly eligibleRewards = computed(() =>
    this.rewards().filter((r) => r.status === RewardStatus.Eligible),
  );
  readonly lockedRewards = computed(() =>
    this.rewards().filter((r) => r.status === RewardStatus.Locked),
  );
  readonly revealedRewards = computed(() =>
    this.rewards().filter((r) => r.status === RewardStatus.Revealed),
  );
  readonly paidSectionRewards = computed(() =>
    this.rewards().filter((r) => PAID_SECTION_STATUSES.has(r.status)),
  );

  /** Whether a withdrawal is even worth offering right now — every value
   *  here comes from the server; this is display logic only. The backend
   *  independently re-checks all of it on the actual request. */
  readonly canWithdraw = computed(() => {
    const settings = this.settings();
    const summary = this.summary();
    return (
      !!settings?.payoutEnabled &&
      !!this.destination() &&
      !!summary &&
      summary.availableAmount >= settings.minimumPayoutAmount
    );
  });

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    this.loadError.set('');
    try {
      const [rewards, summary, settings, destination, history] = await Promise.all([
        this.rewardService.getRewards(),
        this.rewardService.getRewardSummary(),
        this.referral.getProgramSettings(),
        this.payout.getDestination(),
        this.payout.getPayoutHistory(),
      ]);
      this.rewards.set(rewards);
      this.summary.set(summary);
      this.settings.set(settings);
      this.destination.set(destination);
      this.payoutHistory.set(history);
    } catch (err) {
      this.logger.error('rewards: failed to load rewards', err);
      this.loadError.set("Couldn't load your rewards right now. Please try again shortly.");
    } finally {
      this.loading.set(false);
    }
  }

  /** Keeps the on-screen card in sync the moment a reveal succeeds, without
   *  a full reload — the amount itself still only ever comes from the
   *  server's reveal response (see ScratchRewardComponent.reveal()). */
  onRevealed(rewardId: string, result: { status: RewardStatus; amount: number | null }): void {
    this.rewards.update((rewards) =>
      rewards.map((r) =>
        r.id === rewardId ? { ...r, status: result.status, rewardAmount: result.amount } : r,
      ),
    );
  }

  async saveUpiDestination(): Promise<void> {
    const upiId = this.upiInput().trim();
    if (!upiId || this.savingDestination()) return;

    this.savingDestination.set(true);
    try {
      const saved = await this.payout.addUpiDestination(upiId);
      this.destination.set(saved);
      this.upiInput.set('');
      this.toast.show('Payout method saved.', 'success');
    } catch (err) {
      const message = (err as { message?: string })?.message ?? 'Could not save this UPI ID.';
      this.toast.show(message, 'danger');
    } finally {
      this.savingDestination.set(false);
    }
  }

  openConfirm(): void {
    if (this.canWithdraw()) this.showConfirm.set(true);
  }

  closeConfirm(): void {
    this.showConfirm.set(false);
  }

  async confirmWithdraw(): Promise<void> {
    const destination = this.destination();
    if (!destination || this.requestingPayout()) return;

    this.requestingPayout.set(true);
    try {
      await this.payout.requestPayout(destination.id);
      // The server is authoritative for every value below — re-fetch
      // rather than guess at the new balance/history locally.
      const [summary, rewards, history] = await Promise.all([
        this.rewardService.getRewardSummary(),
        this.rewardService.getRewards(),
        this.payout.getPayoutHistory(),
      ]);
      this.summary.set(summary);
      this.rewards.set(rewards);
      this.payoutHistory.set(history);
      this.showConfirm.set(false);
      this.toast.show('Withdrawal requested.', 'success');
    } catch (err) {
      const code = (err as { code?: string })?.code;
      const message =
        code === 'payouts_disabled'
          ? 'Payouts are not enabled yet.'
          : code === 'below_minimum'
            ? 'Your available balance is below the minimum withdrawal amount.'
            : ((err as { message?: string })?.message ?? 'Could not start this payout.');
      this.toast.show(message, 'danger');
    } finally {
      this.requestingPayout.set(false);
    }
  }

  async checkStatus(payoutId: string): Promise<void> {
    if (this.reconcilingId()) return;
    this.reconcilingId.set(payoutId);
    try {
      const result = await this.payout.reconcilePayout(payoutId);
      this.payoutHistory.update((rows) =>
        rows.map((p) => (p.id === payoutId ? { ...p, status: result.status } : p)),
      );
    } catch (err) {
      this.logger.error('rewards: failed to reconcile payout', err);
      this.toast.show("Couldn't check this payout right now.", 'danger');
    } finally {
      this.reconcilingId.set(null);
    }
  }

  statusLabel(status: RewardStatus): string {
    switch (status) {
      case RewardStatus.Locked:
        return 'Waiting on referral';
      case RewardStatus.Eligible:
        return 'Ready to reveal';
      case RewardStatus.Revealed:
        return 'Revealed';
      case RewardStatus.PayoutRequested:
        return 'Payout requested';
      case RewardStatus.Processing:
        return 'Payout processing';
      case RewardStatus.Paid:
        return 'Paid';
      case RewardStatus.Failed:
        return 'Payout failed';
      case RewardStatus.Cancelled:
        return 'Cancelled';
      default:
        return status;
    }
  }

  payoutStatusLabel(status: PayoutStatus): string {
    switch (status) {
      case PayoutStatus.Requested:
      case PayoutStatus.Processing:
      case PayoutStatus.Queued:
        return 'Processing';
      case PayoutStatus.Paid:
        return 'Paid';
      case PayoutStatus.Failed:
        return 'Failed';
      case PayoutStatus.Reversed:
        return 'Reversed';
      case PayoutStatus.Cancelled:
        return 'Cancelled';
      case PayoutStatus.ReviewRequired:
        return 'Under review';
      default:
        return status;
    }
  }

  formatRupees(paise: number): string {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(
      paise / 100,
    );
  }
}
