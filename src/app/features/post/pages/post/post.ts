import {
  Component,
  EventEmitter,
  Output,
  OnDestroy,
  signal,
  inject,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { TagEmojiPipe } from '../../../../shared/pipes/tag-emoji.pipe';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { PostCta, PostIntent, Tag } from '../../../../core/models/tag.model';
import { SharedStateService, PostDraft } from '../../../../core/services/shared-state.service';
import { UserSessionService } from '../../../../core/services/user-session.service';
import { MediaService } from '../../../../core/services/media.service';
import { ToastService } from '../../../../core/services/toast.service';
import { LoggerService } from '../../../../core/services/logger.service';
import { MediaCompressionService } from '../../../../core/services/media-compression.service';
import { TAG_REPOSITORY } from '../../../../core/repositories/repository.tokens';
import { AppRoute } from '../../../../core/enums/route.enum';
import { TagCategory } from '../../../../core/enums/tag-category.enum';
import { NetworkService } from '../../../../core/services/network.service';
import { TelemetryService } from '../../../../core/services/telemetry.service';
import { WorkspaceStateService } from '../../../../layout/workspace/workspace-state.service';
import { emptyTemplateValues, isTemplateComplete, POST_TEMPLATES } from '../../data/post-templates';

/** The post composer is a 2-step wizard: pick a tag, then fill in the rest. */
type PostType = 'personal' | 'business';
type PostStep = 'kind' | 'tag' | 'details' | 'preview';

/** Lightweight intent chips shown for business posts — simpler than the tag category. */
const INTENT_OPTIONS: { value: PostIntent; label: string; icon: string }[] = [
  { value: 'offer', label: 'Offer', icon: 'bi-tag-fill' },
  { value: 'available_now', label: 'Available Now', icon: 'bi-lightning-fill' },
  { value: 'open_slot', label: 'Open Slot', icon: 'bi-calendar2-check' },
  { value: 'happening', label: 'Happening', icon: 'bi-broadcast' },
  { value: 'looking_for', label: 'Looking For', icon: 'bi-search' },
  { value: 'sell_give', label: 'Sell / Give', icon: 'bi-box-seam' },
];

const CTA_OPTIONS: { value: PostCta; label: string }[] = [
  { value: 'message', label: 'Message' },
  { value: 'call', label: 'Call' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'directions', label: 'Directions' },
  { value: 'visit_shop', label: 'Visit Shop' },
  { value: 'view_product', label: 'View Product' },
  { value: 'book', label: 'Book' },
  { value: 'join', label: 'Join' },
  { value: 'interested', label: 'Interested' },
];

/** Quick expiry chips for business posts — minutes, or 'custom' to reveal the dropdown. */
type QuickExpiry = 120 | 240 | 360 | 'today' | 'tonight' | 'custom';
const QUICK_EXPIRY_OPTIONS: { value: QuickExpiry; label: string }[] = [
  { value: 120, label: '2 hours' },
  { value: 240, label: '4 hours' },
  { value: 360, label: 'Half-day' },
  { value: 'today', label: 'Today' },
  { value: 'tonight', label: 'Tonight' },
  { value: 'custom', label: 'Custom' },
];

/** Minutes from now until 23:59:59 today — used by the "Today"/"Tonight" quick chips. */
function minutesUntilEndOfDay(): number {
  const now = new Date();
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  return Math.max(15, Math.round((endOfDay.getTime() - now.getTime()) / 60_000));
}

/** A locally-selected file + instant Object URL preview. */
interface MediaItem {
  file: File;
  previewUrl: string; // URL.createObjectURL() — shown instantly, no FileReader wait
  type: 'image' | 'video';
}

const MAX_MEDIA = 5;

export const MAX_IMAGE_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB
export const MAX_VIDEO_SIZE_BYTES = 30 * 1024 * 1024; // 30 MB
export const MAX_VIDEO_DURATION_SEC = 30; // 30 seconds
export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
  'video/quicktime',
];

/** Rotating compose prompts — a little nudge to start typing. */
const COMPOSE_PROMPTS = [
  "What's buzzing in your hood right now?",
  'Spotted something? Your neighbors want to know…',
  'Share a deal, an alert, or just say hi to the hood 👋',
  'Traffic? Garage sale? Lost cat? Tag it here…',
  "Something happening nearby? Don't keep it to yourself…",
];

@Component({
  selector: 'app-post',
  standalone: true,
  imports: [CommonModule, FormsModule, TagEmojiPipe],
  templateUrl: './post.html',
  styleUrls: ['./post.scss'],
})
export class PostPage implements OnDestroy {
  @Output() discarded = new EventEmitter<void>();
  @Output() submitted = new EventEmitter<Tag>();

  private readonly userSession = inject(UserSessionService);
  private readonly mediaService = inject(MediaService);
  private readonly tagRepo = inject(TAG_REPOSITORY);
  private readonly logger = inject(LoggerService);
  private readonly media = inject(MediaCompressionService);
  private readonly network = inject(NetworkService);
  private readonly telemetry = inject(TelemetryService);
  private readonly workspace = inject(WorkspaceStateService);

  constructor(
    public shared: SharedStateService,
    private router: Router,
    private toast: ToastService,
  ) {
    // Restore the draft after the pick-location round-trip to the map —
    // navigation destroys this component, so the draft lives in SharedStateService.
    const draft = this.shared.postDraft();
    if (draft) {
      this.postType.set(draft.postType ?? 'personal');
      this.formData = {
        headline: draft.headline,
        expiresIn: draft.expiresIn,
        tag: draft.tag,
        intent: (draft.intent as PostIntent) || '',
        price: draft.price ?? '',
        originalPrice: draft.originalPrice ?? '',
        availabilityNote: draft.availabilityNote ?? '',
        cta: (draft.cta as PostCta) || 'message',
        productLink: draft.productLink ?? '',
        isEvent: draft.isEvent,
        eventStart: draft.eventStart,
        eventEnd: draft.eventEnd,
        pollOptions: [...draft.pollOptions],
      };
      this.mediaItems.set(draft.media);
      this.templateValues.set({ ...(draft.templateValues ?? {}) });
      // Old drafts may hold a value outside the personal dropdown presets —
      // snap to 1 hour. Business posts use free-form quick-expiry chips
      // (e.g. "Today" resolves to an arbitrary minute count), so leave those alone.
      if (
        this.postType() === 'personal' &&
        !this.expiryOptions.some((o) => o.value === this.formData.expiresIn)
      ) {
        this.formData.expiresIn = 60;
      }
      // Resuming a draft (e.g. after the pick-location round-trip, or "Post
      // Again"/"Edit & Post" from My Posts) — the user already picked a tag,
      // so skip straight to the requested step.
      if (this.formData.tag) {
        this.step.set(draft.resumeStep ?? 'details');
        if (!Object.keys(this.templateValues()).length) this.syncTemplateValues();
      }
    } else {
      // No in-progress draft — auto-fill post type from the account so most
      // people never see the Kind step at all (they can still switch from
      // the Tag step). Business accounts default to business, everyone else
      // to personal.
      const accountType = this.userSession.user()?.accountType ?? 'personal';
      this.postType.set(accountType);
      this.step.set('tag');
    }
  }

  private saveDraft(): void {
    const draft: PostDraft = {
      postType: this.postType(),
      headline: this.formData.headline,
      expiresIn: this.formData.expiresIn,
      tag: this.formData.tag,
      intent: this.formData.intent,
      price: this.formData.price,
      originalPrice: this.formData.originalPrice,
      availabilityNote: this.formData.availabilityNote,
      cta: this.formData.cta,
      productLink: this.formData.productLink,
      isEvent: this.formData.isEvent,
      eventStart: this.formData.eventStart,
      eventEnd: this.formData.eventEnd,
      pollOptions: [...this.formData.pollOptions],
      templateValues: { ...this.templateValues() },
      media: this.mediaItems(),
    };
    this.shared.postDraft.set(draft);
  }

  // ── Signals (required for zoneless CD) ──────────────────────────────────
  isSubmitting = signal(false);
  mediaItems = signal<MediaItem[]>([]);
  showMapHint = signal(false);
  locationErrorVisible = signal(false);
  shakeLocation = signal(false);
  tagErrorVisible = signal(false);

  /** Step 1: pick a tag. Step 2: quick-fill template (if any) + the rest of the form. */
  readonly step = signal<PostStep>('kind');
  readonly postType = signal<PostType>('personal');
  /** Values for the current tag's quick-fill template, if it has one. */
  templateValues = signal<Record<string, string>>({});

  readonly canAddMore = computed(() => this.mediaItems().length < MAX_MEDIA);
  readonly maxMedia = MAX_MEDIA;

  // ── Form data ────────────────────────────────────────────────────────────
  /** Every category EXCEPT hot-now — that tag has its own top-right toggle. */
  readonly personalTags: readonly TagCategory[] = [
    TagCategory.Around,
    TagCategory.Dating,
    TagCategory.Game,
    TagCategory.Help,
    TagCategory.Notice,
    TagCategory.Alert,
    TagCategory.Poll,
  ];
  readonly businessTags: readonly TagCategory[] = [
    TagCategory.Shop,
    TagCategory.Biz,
    TagCategory.Food,
    TagCategory.Job,
    TagCategory.Health,
    TagCategory.Fitness,
    TagCategory.Learn,
    TagCategory.Space,
    TagCategory.Travel,
    TagCategory.Event,
  ];
  readonly activeTags = computed(() =>
    this.postType() === 'business' ? this.businessTags : this.personalTags,
  );
  readonly composePrompt = COMPOSE_PROMPTS[Math.floor(Math.random() * COMPOSE_PROMPTS.length)];

  /** Post lifetime presets — `expiresIn` is minutes app-wide (see LifespanPipe). */
  readonly expiryOptions = [
    { label: '15 min', value: 15 },
    { label: '1 hour', value: 60 },
    { label: '2 hours', value: 120 },
    { label: '6 hours', value: 360 },
    { label: '1 day', value: 1440 },
    { label: '3 days', value: 4320 },
    { label: '1 week', value: 10080 },
  ];

  /** True when the top-right Hot Now toggle is on. Plain method (not signal)
   *  because `formData` is a POJO — a computed() would cache the initial value
   *  and never re-run when `formData.tag` is mutated. */
  isHotNow(): boolean {
    return this.formData.tag === TagCategory.HotNow;
  }

  readonly user = computed(() => {
    const u = this.userSession.user();
    return {
      name: u?.name ?? 'Guest',
      avatarUrl: 'assets/avatar/panda.png',
    };
  });

  formData = {
    headline: '',
    expiresIn: 60,
    tag: '',
    intent: '' as PostIntent | '',
    price: '',
    originalPrice: '',
    availabilityNote: '',
    cta: 'message' as PostCta,
    productLink: '',
    isEvent: false,
    eventStart: '',
    eventEnd: '',
    pollOptions: ['', ''],
  };

  readonly intentOptions = INTENT_OPTIONS;
  readonly ctaOptions = CTA_OPTIONS;
  readonly quickExpiryOptions = QUICK_EXPIRY_OPTIONS;
  readonly showCustomExpiry = signal(false);

  selectIntent(intent: PostIntent): void {
    this.formData.intent = intent;
    this.tagErrorVisible.set(false);
  }

  selectQuickExpiry(value: QuickExpiry): void {
    if (value === 'custom') {
      this.showCustomExpiry.set(true);
      return;
    }
    this.showCustomExpiry.set(false);
    this.formData.expiresIn =
      value === 'today' || value === 'tonight' ? minutesUntilEndOfDay() : value;
  }

  selectPostType(type: PostType): void {
    this.postType.set(type);
    this.formData.tag = '';
    this.formData.headline = '';
    this.formData.intent = '';
    this.templateValues.set({});
    this.showCustomExpiry.set(false);
    this.step.set('tag');
  }

  goToKindStep(): void {
    this.step.set('kind');
  }

  tagLabel(tag: TagCategory): string {
    const labels: Partial<Record<TagCategory, string>> = {
      [TagCategory.Around]: 'Local update',
      [TagCategory.Dating]: 'Meet people',
      [TagCategory.Game]: 'Games & sports',
      [TagCategory.Help]: 'Ask for help',
      [TagCategory.Notice]: 'Notice',
      [TagCategory.Alert]: 'Alert',
      [TagCategory.Poll]: 'Poll',
      [TagCategory.Shop]: 'Shop & retail',
      [TagCategory.Biz]: 'Service or business',
      [TagCategory.Food]: 'Food & dining',
      [TagCategory.Job]: 'Jobs',
      [TagCategory.Health]: 'Health & care',
      [TagCategory.Fitness]: 'Fitness',
      [TagCategory.Learn]: 'Classes',
      [TagCategory.Space]: 'Space available',
      [TagCategory.Travel]: 'Travel',
      [TagCategory.Event]: 'Business event',
    };
    return labels[tag] ?? tag;
  }

  /** Step 1 → step 2: picking a tag also seeds/resets its quick-fill template. */
  selectTag(tag: string): void {
    this.formData.tag = tag;
    this.tagErrorVisible.set(false);
    this.syncTemplateValues();
    this.step.set('details');
  }

  /** "Change category" link on the details step — keeps the current tag pre-selected. */
  goToTagStep(): void {
    this.step.set('tag');
  }

  /**
   * Top-right "Hot Now" toggle. Turning it on pins tag='hot-now' and shortens
   * the expiry to 2 hours, then jumps to the details step (hot-now has no
   * quick-fill template — it's meant to be typed fast). Turning it off
   * restores the 1-hour default, clears the tag, and returns to step 1 so
   * the user can pick a category again.
   */
  toggleHotNow(): void {
    if (this.isHotNow()) {
      this.formData.tag = '';
      this.formData.expiresIn = 60;
      this.syncTemplateValues();
      this.step.set('tag');
    } else {
      this.postType.set('personal');
      this.formData.tag = TagCategory.HotNow;
      this.formData.expiresIn = 120;
      this.tagErrorVisible.set(false);
      this.syncTemplateValues();
      this.step.set('details');
    }
  }

  // ── Quick-fill templates (see data/post-templates.ts) ───────────────────

  /**
   * Plain method, not computed(): `formData` is a POJO so a computed() would
   * cache the value from the first read and never notice `formData.tag`
   * changing (same reasoning as `isHotNow()` above).
   */
  currentTemplate() {
    if (this.postType() !== 'business') return undefined;
    return POST_TEMPLATES[this.formData.tag as TagCategory];
  }

  private syncTemplateValues(): void {
    const template = this.currentTemplate();
    this.templateValues.set(template ? emptyTemplateValues(template) : {});
  }

  /** Updates one quick-fill field and re-composes the post caption from all of them. */
  onTemplateFieldChange(key: string, value: string): void {
    const next = { ...this.templateValues(), [key]: value };
    this.templateValues.set(next);

    const template = this.currentTemplate();
    if (template) this.formData.headline = template.buildHighlight(next);
  }

  /** True once every required quick-fill field is filled (or the tag has no template). */
  isTemplateReady(): boolean {
    const template = this.currentTemplate();
    return !template || isTemplateComplete(template, this.templateValues());
  }

  // ── Polls ────────────────────────────────────────────────────────────────
  addPollOption(): void {
    if (this.formData.pollOptions.length < 5) {
      this.formData.pollOptions.push('');
    }
  }

  removePollOption(index: number): void {
    if (this.formData.pollOptions.length > 2) {
      this.formData.pollOptions.splice(index, 1);
    }
  }

  trackByIndex(index: number): number {
    return index;
  }

  // ── Media selection ──────────────────────────────────────────────────────

  async onFileSelect(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = ''; // reset so same file can be re-added after removal

    for (const file of files) {
      if (this.mediaItems().length >= MAX_MEDIA) {
        this.toast.show(`You can attach up to ${MAX_MEDIA} files per post.`, 'warning');
        break;
      }

      if (file.type && !ALLOWED_MIME_TYPES.includes(file.type)) {
        this.toast.show(`"${file.name}" has an unsupported media format.`, 'warning');
        continue;
      }

      const isVid = file.type.startsWith('video/');

      if (isVid && file.size > MAX_VIDEO_SIZE_BYTES) {
        this.toast.show(`Video "${file.name}" exceeds maximum size of 30 MB.`, 'warning');
        continue;
      }

      if (!isVid && file.size > MAX_IMAGE_SIZE_BYTES) {
        this.toast.show(`Image "${file.name}" exceeds maximum size of 15 MB.`, 'warning');
        continue;
      }

      if (isVid) {
        const isValidDuration = await this.validateVideoDuration(file);
        if (!isValidDuration) {
          this.toast.show(
            `Video "${file.name}" exceeds maximum duration of 30 seconds.`,
            'warning',
          );
          continue;
        }
      }

      const type: 'image' | 'video' = isVid ? 'video' : 'image';
      // Object URL gives an instant preview without any FileReader roundtrip.
      const previewUrl = URL.createObjectURL(file);
      this.mediaItems.update((items) => [...items, { file, previewUrl, type }]);
    }
  }

  private validateVideoDuration(file: File): Promise<boolean> {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      const objectUrl = URL.createObjectURL(file);

      video.onloadedmetadata = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(video.duration <= MAX_VIDEO_DURATION_SEC);
      };

      video.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        // Fallback to true if browser/environment cannot parse metadata
        resolve(true);
      };

      video.src = objectUrl;
    });
  }

  removeMedia(index: number): void {
    this.mediaItems.update((items) => {
      // Revoke the object URL to free browser memory.
      URL.revokeObjectURL(items[index].previewUrl);
      return items.filter((_, i) => i !== index);
    });
  }

  isVideo(item: MediaItem): boolean {
    return item.type === 'video';
  }

  // ── Location ─────────────────────────────────────────────────────────────

  onPickLocation(): void {
    this.saveDraft(); // survive the component destroy during the map round-trip
    this.showMapHint.set(true);
    this.shared.pickModeActive.set(true); // belt-and-suspenders alongside query param
    void this.router.navigate([AppRoute.Hood], { queryParams: { pick: '1' } });
  }

  useCurrentLocation(): void {
    if (!navigator.geolocation) {
      this.toast.show('Geolocation is not supported by this browser.', 'danger');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const { latitude: lat, longitude: lng } = coords;
        this.shared.updateCoordinates(lat, lng);
        this.shared.updateText('Fetching location…');
        this.shared.locationType.set('pinpoint');
        this.locationErrorVisible.set(false);

        try {
          const res = await fetch(`/api/nominatim/reverse?lat=${lat}&lon=${lng}`);
          const data = res.ok ? await res.json() : null;
          if (data) {
            this.shared.updateText(this.extractPlaceName(data));
            this.shared.updateRegion(
              data.address?.['state'] ?? '',
              data.address?.['country'] ?? '',
            );
          } else {
            this.shared.updateText('Current location');
          }
        } catch {
          this.shared.updateText('Current location');
        }

        this.toast.show(
          'Current location attached. If using a desktop without GPS, click "Pick on map" for precise location.',
          'success',
        );
      },
      () => this.toast.show('Could not read your current location.', 'danger'),
      { timeout: 10000, maximumAge: 60000, enableHighAccuracy: true },
    );
  }

  private extractPlaceName(data: {
    display_name?: string;
    address?: Record<string, string>;
  }): string {
    const a = data.address ?? {};
    return (
      a['neighbourhood'] ||
      a['suburb'] ||
      a['city_district'] ||
      a['city'] ||
      a['town'] ||
      a['village'] ||
      data.display_name?.split(',')[0]?.trim() ||
      'Current location'
    );
  }

  onSearchPlace(): void {
    this.saveDraft();
    this.shared.pickModeActive.set(true);
    void this.router.navigate([AppRoute.Hood], { queryParams: { pick: '1', search: '1' } });
  }

  clearLocation(): void {
    this.shared.clear();
  }

  openPreview(f: NgForm): void {
    if (!this.validateDetails(f)) return;
    this.step.set('preview');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  editPost(): void {
    this.step.set('details');
  }

  private validateDetails(f: NgForm): boolean {
    if (!this.formData.tag) {
      this.tagErrorVisible.set(true);
      this.step.set('tag');
      this.toast.show('Pick a tag for your post.', 'warning');
      return false;
    }
    if (!this.formData.headline.trim()) {
      f.form.markAllAsTouched();
      this.toast.show('Add a title or a few details before previewing.', 'warning');
      return false;
    }
    if (!this.isTemplateReady()) {
      this.toast.show('Complete the required quick-fill fields.', 'warning');
      return false;
    }
    if (!this.shared.coordinates()) {
      this.locationErrorVisible.set(true);
      this.triggerLocationShake();
      this.toast.show('Choose a location before previewing.', 'warning');
      return false;
    }
    if (
      this.formData.isEvent &&
      this.formData.eventStart &&
      this.formData.eventEnd &&
      new Date(this.formData.eventStart) > new Date(this.formData.eventEnd)
    ) {
      this.toast.show('Event start date cannot be after the end date.', 'warning');
      return false;
    }
    return true;
  }

  // ── Submit ───────────────────────────────────────────────────────────────

  async onSubmit(): Promise<void> {
    if (this.isSubmitting()) return;
    if (!this.network.isOnline()) {
      this.toast.show('You are offline. Connect to the internet before posting.', 'warning');
      return;
    }
    if (this.step() !== 'preview') return;

    if (this.formData.isEvent && this.formData.eventStart && this.formData.eventEnd) {
      if (new Date(this.formData.eventStart) > new Date(this.formData.eventEnd)) {
        this.toast.show('Event start date cannot be after the end date.', 'warning');
        return;
      }
    }

    const coords = this.shared.coordinates();
    if (!coords) {
      this.locationErrorVisible.set(true);
      this.triggerLocationShake();
      this.toast.show('Choose a location from the Hood map before posting.', 'warning');
      return;
    }

    this.isSubmitting.set(true);

    try {
      const currentUser = this.userSession.user();
      if (!currentUser) {
        this.toast.show('You must be signed in to post a tag.', 'warning');
        return;
      }

      const uid = currentUser.uid;
      const uploadedUrls: string[] = [];

      for (const item of this.mediaItems()) {
        try {
          // Compress images (WebP) and videos (native GPU MediaRecorder) before upload so we
          // save bandwidth on upload and on every future download.
          const { file } = await this.media.compress(item.file);
          const ext = file.name.split('.').pop() ?? (item.type === 'video' ? 'mp4' : 'jpg');
          const path = `tags/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
          uploadedUrls.push(await this.mediaService.uploadFile(path, file));
        } catch (err) {
          this.logger.error('Media upload failed', err);
          this.toast.show('One file failed to upload — continuing without it.', 'warning');
        }
      }

      const isBusiness = currentUser.accountType === 'business';
      // Angular's number-input value accessor writes back an actual `number` (or ''
      // when cleared), not always the `string` the formData field is typed as —
      // handle both instead of assuming .trim() is available.
      const toNumber = (v: string | number | undefined | null): number | undefined => {
        if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
        const trimmed = (v ?? '').toString().trim();
        if (!trimmed) return undefined;
        const n = Number(trimmed);
        return Number.isFinite(n) ? n : undefined;
      };

      const tagObject: Tag = {
        username: currentUser.name,
        postType: this.postType(),
        businessName: isBusiness ? currentUser.businessName || undefined : undefined,
        businessPhone: isBusiness ? currentUser.businessPhone || undefined : undefined,
        businessWebsite: isBusiness ? currentUser.businessWebsite || undefined : undefined,
        intent: this.postType() === 'business' ? this.formData.intent || 'offer' : undefined,
        price: this.postType() === 'business' ? toNumber(this.formData.price) : undefined,
        originalPrice:
          this.postType() === 'business' ? toNumber(this.formData.originalPrice) : undefined,
        availabilityNote:
          this.postType() === 'business' ? this.formData.availabilityNote.trim() || undefined : undefined,
        cta: this.postType() === 'business' ? this.formData.cta : undefined,
        productLink:
          this.postType() === 'business' ? this.formData.productLink.trim() || undefined : undefined,
        userId: uid,
        highlight: this.formData.headline,
        lat: coords[0],
        lng: coords[1],
        hoodId: this.shared.text() || undefined,
        state: this.shared.state() || undefined,
        country: this.shared.country() || undefined,
        locationType: this.shared.locationType(),
        expiresIn: this.formData.expiresIn,
        tag: this.formData.tag,
        createdAt: new Date().toISOString(),
        images: uploadedUrls,
        eventStart: this.formData.isEvent ? this.formData.eventStart || undefined : undefined,
        eventEnd: this.formData.isEvent ? this.formData.eventEnd || undefined : undefined,
        pollOptions:
          this.formData.tag === TagCategory.Poll
            ? this.formData.pollOptions.filter((o) => o.trim().length > 0)
            : undefined,
        pollVotes: this.formData.tag === TagCategory.Poll ? {} : undefined,
      };

      await firstValueFrom(this.tagRepo.create(tagObject));
      this.telemetry.track('activation.post-created', { kind: tagObject.tag ?? 'tag' });
      this.submitted.emit(tagObject);
      this.showPublishedPostInFeed(tagObject);
      this.resetForm();
      this.toast.show('Published to your local feed.', 'success');
      void this.router.navigate([AppRoute.FeedBeta]);
    } catch (e) {
      this.logger.error('Error saving tag', e);
      this.toast.show('Failed to post tag. Please try again.', 'danger');
    } finally {
      this.isSubmitting.set(false);
    }
  }

  onDiscard(): void {
    this.resetForm();
    this.discarded.emit();
    void this.router.navigate([AppRoute.Hood]);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private resetForm(): void {
    // Revoke all object URLs to avoid memory leaks.
    this.mediaItems().forEach((m) => URL.revokeObjectURL(m.previewUrl));
    this.mediaItems.set([]);
    this.formData = {
      headline: '',
      expiresIn: 60,
      tag: '',
      intent: '',
      price: '',
      originalPrice: '',
      availabilityNote: '',
      cta: 'message',
      productLink: '',
      isEvent: false,
      eventStart: '',
      eventEnd: '',
      pollOptions: ['', ''],
    };
    this.shared.postDraft.set(null);
    this.showMapHint.set(false);
    this.locationErrorVisible.set(false);
    this.shakeLocation.set(false);
    this.tagErrorVisible.set(false);
    this.templateValues.set({});
    this.showCustomExpiry.set(false);
    // Back to the account's default post type, straight to the Tag step —
    // same auto-skip logic as a fresh page load.
    this.postType.set(this.userSession.user()?.accountType ?? 'personal');
    this.step.set('tag');
  }

  private showPublishedPostInFeed(post: Tag): void {
    const state = post.state?.trim() ?? '';
    const country = post.country?.trim() ?? '';
    const areaSource = state && country ? `${state}::${country}` : country || state;
    const areaId = areaSource
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    if (!areaId) return;

    const tag = post.tag.toLowerCase();
    const category =
      tag === 'hot-now'
        ? 'hot-now'
        : tag === 'dating'
          ? 'dating'
          : tag === 'game' || tag === 'fitness'
            ? 'game'
            : tag === 'job' || tag === 'biz'
              ? 'job'
              : 'around';

    this.workspace.feedBetaScope.set({
      areaId,
      location: state || country,
      country: country || state,
      hood: post.hoodId || state || country,
      category,
      freeform: true,
    });
  }

  private triggerLocationShake(): void {
    this.shakeLocation.set(false);
    setTimeout(() => this.shakeLocation.set(true));
    setTimeout(() => this.shakeLocation.set(false), 450);
  }

  /**
   * A saved draft is only meant to survive the "pick location on the map"
   * round-trip (`onPickLocation`/`onSearchPlace` set `pickModeActive` right
   * before navigating away). If this component is destroyed for any other
   * reason — closing the composer, tapping another nav item, browser back —
   * `pickModeActive` is still false, so drop the draft. Otherwise the next
   * time someone opens /post it silently resumes here on the details step
   * instead of starting fresh on the tag step.
   */
  ngOnDestroy(): void {
    if (!this.shared.pickModeActive()) {
      this.shared.postDraft.set(null);
    }
  }
}
