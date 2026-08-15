import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
  OnDestroy,
  signal,
  inject,
  computed,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { TagEmojiPipe } from '../../../../shared/pipes/tag-emoji.pipe';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { PostCta, PostIntent, PublishStatus, Tag } from '../../../../core/models/tag.model';
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
// Legacy personal-post templates (personal categories unchanged)
import { POST_TEMPLATES } from '../../data/post-templates';
// Step 1: registry-based business post templates
import {
  PostTemplateDefinition,
  emptyTemplateValues,
  isTemplateComplete,
  resolveTemplateDefaults,
  mapTemplateValues,
  sanitiseTemplateData,
  resolveExpiry,
  restoreTemplateValues,
} from '../../data/post-template-registry';
import { PostTemplateRegistryService } from '../../services/post-template-registry.service';
import { PostTemplateAnalyticsService } from '../../services/post-template-analytics.service';
import {
  BUSINESS_TAG_CATEGORIES,
  PERSONAL_TAG_CATEGORIES,
  tagCategoryLabel,
} from '../../../../shared/constants/business-tags';
import { BusinessPostTemplatePickerComponent } from '../../components/business-template-picker/business-template-picker.component';
import { TemplateFormComponent } from '../../components/template-form/template-form.component';

/**
 * Step flow for the post composer.
 *
 * Personal:  tag → details → preview  (unchanged)
 * Business:  template → details → preview
 *
 * Business accounts with a locked `businessCategory` skip straight to the
 * template picker; personal accounts pick a tag each time.
 */
type PostType = 'personal' | 'business';
type PostStep = 'tag' | 'template' | 'details' | 'preview';

/** Lightweight intent chips shown for personal posts — kept for personal flow. */
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
  'video/x-m4v',
];

const MIME_TYPE_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  m4v: 'video/x-m4v',
};

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
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    TagEmojiPipe,
    BusinessPostTemplatePickerComponent,
    TemplateFormComponent,
  ],
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
  private readonly templateRegistry = inject(PostTemplateRegistryService);
  private readonly templateAnalytics = inject(PostTemplateAnalyticsService);

  public readonly shared = inject(SharedStateService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);

  /**
   * Per-template value cache — survives template switches within a single
   * session so the user doesn't lose data when comparing post types.
   * Key: template id (e.g. "daily-special"), Value: field values.
   */
  private readonly templateValueCache = new Map<string, Record<string, string>>();

  constructor() {
    // Step 5.A: resuming a saved draft/scheduled post (?draftId=<id> in the
    // route) always wins over the ephemeral pick-location postDraft below —
    // it's a real DB row, not a survive-the-navigation convenience copy.
    const resumePostId = this.route.snapshot.queryParamMap.get('draftId');
    if (resumePostId) {
      this.step.set('tag');
      const resumeRef = effect(
        () => {
          const user = this.userSession.user();
          if (!user) return; // signal hasn't resolved yet — wait
          resumeRef.destroy();
          this.tagRepo.getById(resumePostId).subscribe({
            next: (post) => {
              if (!post || post.userId !== user.uid) {
                this.toast.show('Could not find that draft.', 'warning');
                this.postType.set(user.accountType ?? 'personal');
                return;
              }
              this.loadFromExistingPost(post);
            },
            error: (err) => {
              this.logger.error('Failed to load draft for editing', err);
              this.toast.show('Could not load that draft.', 'danger');
            },
          });
        },
        { allowSignalWrites: true },
      );
      return;
    }

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
      this.isHighlightManuallyEdited.set(draft.isHighlightManuallyEdited ?? false);
      // Re-hydrate the active template definition from the registry so the
      // draft accurately preserves subtype/version across the location round-trip.
      if (draft.postType === 'business' && draft.tag) {
        const subtypeId = draft.postSubtype ?? 'general';
        // resolveForDisplay (not getTemplate) — a since-disabled template must
        // still resolve so the pick-location round-trip doesn't silently swap
        // it out from under the user (Step 5.B).
        const def =
          this.templateRegistry.resolveForDisplay(draft.tag, subtypeId, draft.templateVersion) ??
          this.templateRegistry.getDefaultTemplate(draft.tag);
        this.activeTemplate.set(def);
        // Seed the cache so switching back to this template restores values.
        if (def) this.templateValueCache.set(def.id, { ...this.templateValues() });
      }
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
      // No in-progress draft. The user signal starts null and resolves
      // asynchronously, so use an effect that fires once the profile
      // arrives. Business accounts with a fixed category go to the template
      // picker; personal accounts pick a tag.
      this.step.set('tag');

      const initRef = effect(
        () => {
          const user = this.userSession.user();
          if (!user) return; // signal hasn't resolved yet — wait
          const accountType = user.accountType ?? 'personal';
          this.postType.set(accountType);
          if (accountType === 'business' && user.businessCategory) {
            this.formData.tag = user.businessCategory;
            this.step.set('template');
          }
          // Run once — destroy the effect after the first real user arrives.
          initRef.destroy();
        },
        { allowSignalWrites: true },
      );
    }
  }

  /** Business accounts can only post as the business they registered with
   *  (see the details-step "Post as personal instead" link) — turning it off
   *  drops them into the Tag step to pick a personal category, since
   *  personal posts (unlike business) aren't tied to one fixed tag. */
  switchToPersonalMode(): void {
    this.postType.set('personal');
    this.formData.tag = '';
    this.formData.intent = '';
    this.templateValues.set({});
    this.activeTemplate.set(null);
    this.isHighlightManuallyEdited.set(false);
    this.tagErrorVisible.set(false);
    this.step.set('tag');
  }

  private saveDraft(): void {
    const activeDef = this.activeTemplate();
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
      // Step 1: preserve template context across the pick-location round-trip.
      postSubtype: activeDef?.id,
      templateVersion: activeDef?.version,
      templateData: { ...this.templateValues() },
      isHighlightManuallyEdited: this.isHighlightManuallyEdited(),
    };
    this.shared.postDraft.set(draft);
  }

  /**
   * Step 5.A: populates the composer from an existing draft/scheduled (or,
   * for the "edit scheduled post" flow, any) Tag row — resolving its template
   * from the registry via tag+postSubtype rather than storing the template
   * definition itself. Ownership must already be verified by the caller.
   */
  private loadFromExistingPost(post: Tag): void {
    this.editingPostId.set(post.id ?? null);
    this.editingPublishStatus.set(post.publishStatus ?? 'published');
    this.editingScheduledFor.set(post.scheduledFor ?? null);
    this.postType.set(post.postType === 'business' ? 'business' : 'personal');

    this.formData = {
      headline: post.highlight,
      expiresIn: post.expiresIn,
      tag: post.tag,
      intent: post.intent ?? '',
      price: post.price != null ? String(post.price) : '',
      originalPrice: post.originalPrice != null ? String(post.originalPrice) : '',
      availabilityNote: post.availabilityNote ?? '',
      cta: post.cta ?? 'message',
      productLink: post.productLink ?? '',
      isEvent: !!(post.eventStart || post.eventEnd),
      eventStart: post.eventStart ?? '',
      eventEnd: post.eventEnd ?? '',
      pollOptions: post.pollOptions?.length ? [...post.pollOptions] : ['', ''],
    };
    // The saved headline is exactly what the author left it as — don't let
    // the next template field edit silently recompute over it.
    this.isHighlightManuallyEdited.set(true);
    this.existingImages.set(post.images ?? []);

    if (post.postType === 'business' && post.postSubtype) {
      // resolveForDisplay (not getTemplate) — resuming a draft/scheduled post
      // whose template has since been disabled must keep its own template,
      // not silently swap in the category's current default (Step 5.B item 24).
      const def =
        this.templateRegistry.resolveForDisplay(post.tag, post.postSubtype, post.templateVersion) ??
        this.templateRegistry.getDefaultTemplate(post.tag);
      this.activeTemplate.set(def);
      if (def) {
        const tagFields: Record<string, unknown> = {
          price: post.price,
          originalPrice: post.originalPrice,
          availabilityNote: post.availabilityNote,
          eventStart: post.eventStart,
          eventEnd: post.eventEnd,
          productLink: post.productLink,
          cta: post.cta,
          intent: post.intent,
        };
        const values = restoreTemplateValues(def, tagFields, post.templateData);
        this.templateValues.set(values);
        this.templateValueCache.set(def.id, { ...values });
      }
    }

    if (Number.isFinite(post.lat) && Number.isFinite(post.lng) && (post.lat || post.lng)) {
      this.shared.updateCoordinates(post.lat, post.lng);
    }
    if (post.hoodId) this.shared.updateText(post.hoodId);
    this.shared.updateRegion(post.state ?? '', post.country ?? '');
    if (post.locationType) this.shared.locationType.set(post.locationType);

    this.step.set('details');
  }

  // ── Signals (required for zoneless CD) ──────────────────────────────────
  isSubmitting = signal(false);
  mediaItems = signal<MediaItem[]>([]);
  showMapHint = signal(false);
  locationErrorVisible = signal(false);
  shakeLocation = signal(false);
  tagErrorVisible = signal(false);

  readonly step = signal<PostStep>('tag');
  readonly postType = signal<PostType>('personal');
  /** Values for the current tag's quick-fill template, if it has one. */
  templateValues = signal<Record<string, string>>({});
  /** The active template definition — set when a business category is resolved. */
  readonly activeTemplate = signal<PostTemplateDefinition | null>(null);
  /** True once the user hand-edits the generated headline — stops further
   *  template field changes from silently overwriting their edit. */
  readonly isHighlightManuallyEdited = signal(false);

  // ── Step 5.A: draft / scheduled / publish ───────────────────────────────
  /** Set when resuming an existing draft/scheduled post — subsequent saves
   *  update this row instead of creating a new one. */
  readonly editingPostId = signal<string | null>(null);
  /** The publish state of the post currently being edited, if any — drives
   *  the "Move back to draft" action, only shown for a scheduled post. */
  readonly editingPublishStatus = signal<PublishStatus | null>(null);
  /** The post's current scheduled_for, shown read-only in the "Editing scheduled post" badge. */
  readonly editingScheduledFor = signal<string | null>(null);
  /** Already-uploaded image URLs from a draft being resumed — new files from
   *  mediaItems are appended to these at save time, not re-uploaded. */
  readonly existingImages = signal<string[]>([]);
  readonly showScheduleForm = signal(false);
  readonly scheduleDate = signal('');
  readonly scheduleTime = signal('');

  readonly canAddMore = computed(() => this.mediaItems().length < MAX_MEDIA);
  readonly maxMedia = MAX_MEDIA;

  // ── Form data ────────────────────────────────────────────────────────────
  readonly personalTags = PERSONAL_TAG_CATEGORIES;
  readonly businessTags = BUSINESS_TAG_CATEGORIES;
  readonly activeTags = computed(() =>
    this.postType() === 'business' ? this.businessTags : this.personalTags,
  );
  readonly composePrompt = COMPOSE_PROMPTS[Math.floor(Math.random() * COMPOSE_PROMPTS.length)];

  /** True once a business account's tag is locked to their registered
   *  category — that's the normal case; only pre-migration business
   *  accounts without a category set fall back to picking one per post. */
  readonly businessCategoryLocked = computed(
    () => this.postType() === 'business' && !!this.userSession.user()?.businessCategory,
  );
  /** True for a business account that hasn't registered a category yet —
   *  shown a "set your category first" message instead of an empty picker. */
  readonly businessCategoryMissing = computed(
    () => this.postType() === 'business' && !this.userSession.user()?.businessCategory,
  );
  /** Business name/category snapshot shown in the preview card. */
  readonly businessInfo = computed(() => {
    const u = this.userSession.user();
    return { name: u?.businessName, category: u?.businessCategory };
  });
  /** Structured title from the active template's buildTitle(), if any. */
  readonly previewTitle = computed(() => {
    const def = this.activeTemplate();
    if (this.postType() !== 'business' || !def?.buildTitle) return '';
    return def.buildTitle(this.templateValues()) || '';
  });
  /** Step count shown in the header. Business with locked category:
   *  template → details → preview (3 steps). Personal: tag → details → preview (3 steps). */
  readonly totalSteps = computed(() => 3);
  readonly stepNumber = computed(() => {
    const s = this.step();
    if (s === 'tag' || s === 'template') return 1;
    if (s === 'details') return 2;
    return 3;
  });

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

  tagLabel(tag: TagCategory): string {
    return tagCategoryLabel(tag);
  }

  /** Step 1 → step 2 (personal flow): picking a tag seeds/resets its quick-fill template. */
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
   * Business template picker: user selected a template.
   * Seeds defaults, restores cached values if any, and advances to details.
   */
  onTemplateSelected(template: PostTemplateDefinition): void {
    // Save current template values to cache before switching.
    const prev = this.activeTemplate();
    if (prev) {
      this.templateValueCache.set(prev.id, { ...this.templateValues() });
    }

    this.activeTemplate.set(template);
    // Fresh template selection — any prior manual headline edit no longer applies.
    this.isHighlightManuallyEdited.set(false);

    // Restore cached values or seed fresh defaults.
    const cached = this.templateValueCache.get(template.id);
    const values = cached ? { ...cached } : emptyTemplateValues(template);
    this.templateValues.set(values);

    // Apply template defaults for intent, CTA, expiry.
    const defaults = resolveTemplateDefaults(template);
    if (defaults.intent) this.formData.intent = defaults.intent;
    if (defaults.cta) this.formData.cta = defaults.cta;
    if (defaults.expiresIn) this.formData.expiresIn = defaults.expiresIn;

    // Pull price/originalPrice/availability/eventStart-End/cta/intent/expiry
    // straight from any mapped field values (covers restored cached values).
    this.applyMappedFieldsFromTemplate(template, values);

    // Re-compose headline from the (possibly cached) values.
    this.formData.headline = template.buildHighlight(values);

    // Step 5.B: lightweight, non-blocking usage analytics.
    this.templateAnalytics.recordTemplateSelected(
      this.formData.tag,
      template.id,
      template.version,
    );

    this.step.set('details');
  }

  /**
   * Copies template field values that declare a `mapsTo` onto the universal
   * formData fields (price, originalPrice, availabilityNote, productLink,
   * cta, intent, eventStart/eventEnd, expiresIn) so the rest of the composer
   * (and final Tag submission) sees them without re-deriving from templateData.
   */
  private applyMappedFieldsFromTemplate(
    template: PostTemplateDefinition,
    values: Record<string, string>,
  ): void {
    const { tagFields } = mapTemplateValues(template, values);
    if (tagFields.price !== undefined) this.formData.price = tagFields.price;
    if (tagFields.originalPrice !== undefined) this.formData.originalPrice = tagFields.originalPrice;
    if (tagFields.availabilityNote !== undefined) this.formData.availabilityNote = tagFields.availabilityNote;
    if (tagFields.productLink !== undefined) this.formData.productLink = tagFields.productLink;
    if (tagFields.cta !== undefined) this.formData.cta = tagFields.cta as PostCta;
    if (tagFields.intent !== undefined) this.formData.intent = tagFields.intent as PostIntent;
    if (tagFields.eventStart !== undefined) {
      this.formData.eventStart = tagFields.eventStart;
      this.formData.isEvent = true;
    }
    if (tagFields.eventEnd !== undefined) {
      this.formData.eventEnd = tagFields.eventEnd;
      this.formData.isEvent = true;
    }
    const expiry = resolveExpiry(template, values);
    if (expiry !== undefined) this.formData.expiresIn = expiry;
  }

  /** "Set your business category first" screen — goes to the profile route. */
  goToProfile(): void {
    void this.router.navigate([AppRoute.Profile]);
  }

  /** Human label for the currently selected CTA — used in the preview card. */
  ctaLabel(): string {
    return this.ctaOptions.find((o) => o.value === this.formData.cta)?.label ?? '';
  }

  /** "18 Aug, 9:00 am" — never expose the raw ISO scheduled_for value in the UI. */
  formatScheduledFor(iso: string): string {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }

  /** "Change post type" — go back to the template picker (business only). */
  goToTemplatePicker(): void {
    // Save current values before leaving.
    const current = this.activeTemplate();
    if (current) {
      this.templateValueCache.set(current.id, { ...this.templateValues() });
    }
    this.step.set('template');
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
   * For personal posts: resolved from the legacy POST_TEMPLATES map.
   * For business posts: the activeTemplate signal (set via template picker).
   */
  currentTemplate(): PostTemplateDefinition | import('../../data/post-templates').PostTemplate | undefined {
    if (this.postType() === 'business') {
      return this.activeTemplate() ?? undefined;
    }
    return POST_TEMPLATES[this.formData.tag as TagCategory];
  }

  private syncTemplateValues(): void {
    if (this.postType() === 'business') {
      // Resolve the default template from the registry for this business category.
      const def = this.templateRegistry.getDefaultTemplate(this.formData.tag);
      this.activeTemplate.set(def);
      this.templateValues.set(def ? emptyTemplateValues(def) : {});
    } else {
      this.activeTemplate.set(null);
      const template = POST_TEMPLATES[this.formData.tag as TagCategory];
      this.templateValues.set(template ? emptyTemplateValues(template) : {});
    }
  }

  /** Splits a comma-separated multi-select value for the template binding. */
  splitMultiValue(v: string | undefined): string[] {
    return (v || '').split(',').filter((s) => s.length > 0);
  }

  /** Maps extended TemplateFieldType to an HTML input type attribute. */
  templateFieldInputType(type: string): string {
    switch (type) {
      case 'number':
      case 'price': return 'number';
      case 'date': return 'date';
      case 'time': return 'time';
      case 'datetime': return 'datetime-local';
      case 'url': return 'url';
      case 'phone': return 'tel';
      default: return 'text';
    }
  }

  /** Updates one quick-fill field and re-composes the post caption from all of them
   *  — unless the user has already hand-edited the headline, in which case their
   *  edit is left alone. */
  onTemplateFieldChange(key: string, value: string): void {
    const next = { ...this.templateValues(), [key]: value };
    this.templateValues.set(next);

    if (this.postType() === 'business') {
      const active = this.activeTemplate();
      if (active) {
        this.applyMappedFieldsFromTemplate(active, next);
        if (!this.isHighlightManuallyEdited()) {
          this.formData.headline = active.buildHighlight(next);
        }
        // Keep the per-template cache in sync.
        this.templateValueCache.set(active.id, { ...next });
      }
    } else {
      const template = this.currentTemplate();
      if (template) this.formData.headline = template.buildHighlight(next);
    }
  }

  /** Headline textarea change handler — flags a manual edit for business posts
   *  so subsequent template field changes stop overwriting the user's text. */
  onHeadlineChange(value: string): void {
    this.formData.headline = value;
    if (this.postType() === 'business') this.isHighlightManuallyEdited.set(true);
  }

  /** Handles the { key, value } event from TemplateFormComponent. */
  onTemplateFormChange(event: { key: string; value: string }): void {
    this.onTemplateFieldChange(event.key, event.value);
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

  private isPoll(): boolean {
    return this.formData.tag === TagCategory.Poll || (this.formData.tag as string) === 'poll';
  }

  private validPollOptions(): string[] | null {
    const options = (this.formData.pollOptions ?? []).map((option) => option.trim());
    if (options.length < 2 || options.length > 5 || options.some((option) => !option)) {
      this.toast.show(
        'Add between 2 and 5 non-empty poll options before previewing or publishing.',
        'warning',
      );
      return null;
    }
    return options;
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

      const normalized = this.normalizeMediaFile(file);
      if (!normalized) {
        this.toast.show(`"${file.name}" has an unsupported media format.`, 'warning');
        continue;
      }
      const { file: mediaFile, type } = normalized;
      const isVid = type === 'video';

      if (isVid && mediaFile.size > MAX_VIDEO_SIZE_BYTES) {
        this.toast.show(`Video "${file.name}" exceeds maximum size of 30 MB.`, 'warning');
        continue;
      }

      if (!isVid && mediaFile.size > MAX_IMAGE_SIZE_BYTES) {
        this.toast.show(`Image "${file.name}" exceeds maximum size of 15 MB.`, 'warning');
        continue;
      }

      if (isVid) {
        const validation = await this.validateVideoDuration(mediaFile);
        if (validation === 'too-long') {
          this.toast.show(
            `Video "${file.name}" exceeds maximum duration of 30 seconds.`,
            'warning',
          );
          continue;
        }
        if (validation === 'unreadable') {
          this.toast.show(`Video "${file.name}" could not be read by this browser.`, 'warning');
          continue;
        }
      }

      // Object URL gives an instant preview without any FileReader roundtrip.
      const previewUrl = URL.createObjectURL(mediaFile);
      this.mediaItems.update((items) => [...items, { file: mediaFile, previewUrl, type }]);
    }
  }

  private normalizeMediaFile(file: File): { file: File; type: 'image' | 'video' } | null {
    const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
    const canonicalMime = MIME_TYPE_BY_EXTENSION[extension] ?? file.type.toLowerCase();
    if (!ALLOWED_MIME_TYPES.includes(canonicalMime)) return null;
    const type: 'image' | 'video' = canonicalMime.startsWith('video/') ? 'video' : 'image';
    if (file.type === canonicalMime) return { file, type };
    return {
      file: new File([file], file.name, { type: canonicalMime, lastModified: file.lastModified }),
      type,
    };
  }

  private validateVideoDuration(file: File): Promise<'valid' | 'too-long' | 'unreadable'> {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      const objectUrl = URL.createObjectURL(file);

      video.onloadedmetadata = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(
          Number.isFinite(video.duration)
            ? video.duration <= MAX_VIDEO_DURATION_SEC
              ? 'valid'
              : 'too-long'
            : 'unreadable',
        );
      };

      video.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve('unreadable');
      };

      video.src = objectUrl;
    });
  }

  removeMedia(index: number): void {
    this.mediaItems.update((items) => {
      // Revoke the object URL to free browser memory.
      const item = items[index];
      if (item) URL.revokeObjectURL(item.previewUrl);
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
          const data = res.ok
            ? ((await res.json()) as { display_name?: string; address?: Record<string, string> })
            : null;
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
      this.step.set(this.postType() === 'business' ? 'template' : 'tag');
      this.toast.show('Pick a tag for your post.', 'warning');
      return false;
    }
    if (!this.formData.headline.trim()) {
      f.form.markAllAsTouched();
      this.toast.show('Add a title or a few details before previewing.', 'warning');
      return false;
    }
    if (this.isPoll() && !this.validPollOptions()) return false;
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

  /** Personal posts' (ngSubmit) target and the native form-submit fallback for
   *  business posts — both just publish immediately, same as before Step 5.A. */
  async onSubmit(): Promise<void> {
    if (this.step() !== 'preview') return;
    await this.publishNow();
  }

  /** Preview screen action — publishes immediately (renamed from the old onSubmit body). */
  async publishNow(): Promise<void> {
    if (this.step() !== 'preview') return;
    await this.persistPost('published');
  }

  /**
   * Save Draft (Step 5.A) — deliberately the lightest of the three actions:
   * a draft only needs a post type, nothing else has to be "publicly complete".
   * Available from the details step (no preview needed) as well as preview.
   */
  async saveAsDraft(): Promise<void> {
    if (!this.formData.tag) {
      this.toast.show('Pick a post type before saving a draft.', 'warning');
      return;
    }
    await this.persistPost('draft');
  }

  openScheduleForm(): void {
    this.showScheduleForm.set(true);
  }

  cancelSchedule(): void {
    this.showScheduleForm.set(false);
  }

  /** Preview screen action — same completeness bar as Publish Now, just deferred. */
  async confirmSchedule(): Promise<void> {
    if (!this.scheduleDate() || !this.scheduleTime()) {
      this.toast.show('Pick a publish date and time.', 'warning');
      return;
    }
    // new Date('YYYY-MM-DDTHH:MM') parses as local time in every evergreen
    // browser — toISOString() below then stores the correct absolute instant
    // regardless of the author's timezone.
    const local = new Date(`${this.scheduleDate()}T${this.scheduleTime()}`);
    if (isNaN(local.getTime())) {
      this.toast.show('That date/time is not valid.', 'warning');
      return;
    }
    if (local.getTime() <= Date.now()) {
      this.toast.show('Pick a time in the future.', 'warning');
      return;
    }
    await this.persistPost('scheduled', local.toISOString());
    this.showScheduleForm.set(false);
  }

  /** Owner-only action while editing a scheduled post: pull it back to draft. */
  async moveToDraft(): Promise<void> {
    const id = this.editingPostId();
    if (!id) return;
    try {
      await firstValueFrom(
        this.tagRepo.update(id, {
          publishStatus: 'draft',
          scheduledFor: null,
          publishedAt: null,
        }),
      );
      this.editingPublishStatus.set('draft');
      this.toast.show('Moved back to draft.', 'success');
    } catch (e) {
      this.logger.error('Failed to move post back to draft', e);
      this.toast.show('Could not update the post. Please try again.', 'danger');
    }
  }

  /**
   * Core of Save Draft / Schedule / Publish Now — builds the same Tag shape
   * either way and routes through the existing repository/mapper. Editing an
   * existing draft/scheduled post updates that row (editingPostId) instead of
   * creating a new one.
   */
  private async persistPost(status: PublishStatus, scheduledFor?: string): Promise<void> {
    if (this.isSubmitting()) return;
    if (!this.network.isOnline()) {
      this.toast.show('You are offline. Connect to the internet before continuing.', 'warning');
      return;
    }

    const isDraft = status === 'draft';

    let pollOptions: string[] | undefined;
    if (this.isPoll()) {
      pollOptions = this.validPollOptions() ?? undefined;
      if (!pollOptions && !isDraft) return;
    }

    if (this.formData.isEvent && this.formData.eventStart && this.formData.eventEnd) {
      if (new Date(this.formData.eventStart) > new Date(this.formData.eventEnd)) {
        this.toast.show('Event start date cannot be after the end date.', 'warning');
        return;
      }
    }

    const coords = this.shared.coordinates();
    if (!coords && !isDraft) {
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
      const uploadedUrls: string[] = [...this.existingImages()];

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

      const nowIso = new Date().toISOString();

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
          this.postType() === 'business'
            ? this.formData.availabilityNote.trim() || undefined
            : undefined,
        cta: this.postType() === 'business' ? this.formData.cta : undefined,
        productLink:
          this.postType() === 'business'
            ? this.formData.productLink.trim() || undefined
            : undefined,
        userId: uid,
        highlight: this.formData.headline,
        lat: coords ? coords[0] : 0,
        lng: coords ? coords[1] : 0,
        hoodId: this.shared.text() || undefined,
        state: this.shared.state() || undefined,
        country: this.shared.country() || undefined,
        locationType: this.shared.locationType(),
        expiresIn: this.formData.expiresIn,
        tag: this.formData.tag,
        createdAt: nowIso,
        images: uploadedUrls,
        eventStart: this.formData.isEvent ? this.formData.eventStart || undefined : undefined,
        eventEnd: this.formData.isEvent ? this.formData.eventEnd || undefined : undefined,
        pollOptions: pollOptions,
        pollVotes: this.isPoll() ? {} : undefined,
        // Step 5.A publishing state — expiresIn is anchored on published_at
        // (DB-side), not draft/schedule creation time.
        publishStatus: status,
        publishedAt: status === 'published' ? nowIso : null,
        scheduledFor: status === 'scheduled' ? scheduledFor : null,
        // Step 1 template context — stored on every business post.
        ...(this.postType() === 'business'
          ? (() => {
              const activeDef = this.activeTemplate();
              const rawValues = this.templateValues();
              const sanitizedData = activeDef
                ? sanitiseTemplateData(activeDef, rawValues)
                : {};
              const builtTitle = activeDef?.buildTitle?.(rawValues) || '';
              return {
                postSubtype: activeDef?.id,
                templateVersion: activeDef?.version,
                // Prefer the template's structured title; fall back to the headline.
                title: builtTitle || this.formData.headline.trim() || undefined,
                templateData: Object.keys(sanitizedData).length ? sanitizedData : undefined,
              };
            })()
          : {}),
      };

      const existingId = this.editingPostId();
      const saved = await firstValueFrom(
        existingId ? this.tagRepo.update(existingId, tagObject) : this.tagRepo.create(tagObject),
      );

      // Step 5.B: record only after the post itself successfully exists — a
      // failed publish is never recorded as published. Business posts only;
      // personal posts have no template category to attribute the event to.
      if (this.postType() === 'business') {
        const activeDef = this.activeTemplate();
        if (status === 'published') {
          this.templateAnalytics.recordPublished(
            this.formData.tag,
            activeDef?.id,
            activeDef?.version,
            saved.id,
          );
        } else if (status === 'draft') {
          this.templateAnalytics.recordDraftSaved(
            this.formData.tag,
            activeDef?.id,
            activeDef?.version,
            saved.id,
          );
        } else {
          this.templateAnalytics.recordScheduled(
            this.formData.tag,
            activeDef?.id,
            activeDef?.version,
            saved.id,
          );
        }
      }

      if (status === 'published') {
        this.telemetry.track('activation.post-created', { kind: saved.tag ?? 'tag' });
        this.submitted.emit(saved);
        this.showPublishedPostInFeed(saved);
        this.resetForm();
        this.toast.show(
          existingId ? 'Post published.' : 'Published to your local feed.',
          'success',
        );
        void this.router.navigate([AppRoute.FeedBeta]);
      } else {
        this.resetForm();
        this.toast.show(
          status === 'draft' ? 'Saved as draft.' : 'Post scheduled.',
          'success',
        );
        void this.router.navigate([AppRoute.Profile]);
      }
    } catch (e) {
      this.logger.error('Error saving tag', e);
      this.toast.show('Failed to save post. Please try again.', 'danger');
    } finally {
      this.isSubmitting.set(false);
    }
  }

  onDiscard(): void {
    this.resetForm();
    this.discarded.emit();
    void this.router.navigate([AppRoute.Hood]);
  }

  /** Delete the draft/scheduled post currently being edited — same repository
   *  deletion path as any other post, no separate drafts system. */
  async deleteCurrentPost(): Promise<void> {
    const id = this.editingPostId();
    if (!id) return;
    try {
      await firstValueFrom(this.tagRepo.delete(id));
      this.toast.show('Deleted.', 'success');
      this.resetForm();
      void this.router.navigate([AppRoute.Profile]);
    } catch (e) {
      this.logger.error('Failed to delete post', e);
      this.toast.show('Could not delete the post. Please try again.', 'danger');
    }
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
    this.activeTemplate.set(null);
    this.templateValueCache.clear();
    this.isHighlightManuallyEdited.set(false);
    this.showCustomExpiry.set(false);
    // Step 5.A
    this.editingPostId.set(null);
    this.editingPublishStatus.set(null);
    this.editingScheduledFor.set(null);
    this.existingImages.set([]);
    this.showScheduleForm.set(false);
    this.scheduleDate.set('');
    this.scheduleTime.set('');
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
            : tag === 'job' || tag === 'biz' || tag === 'service' || tag === 'auto'
              ? 'job'
              : tag === 'beauty' || tag === 'health' || tag === 'space' || tag === 'travel' || tag === 'event' || tag === 'learn'
                ? 'around'
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
