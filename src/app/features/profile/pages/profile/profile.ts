import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom, of, switchMap } from 'rxjs';
import { Tag } from '../../../../core/models/tag.model';
import { TAG_REPOSITORY } from '../../../../core/repositories/repository.tokens';
import { UserSessionService } from '../../../../core/services/user-session.service';
import { ToastService } from '../../../../core/services/toast.service';
import { SharedStateService } from '../../../../core/services/shared-state.service';
import { LoggerService } from '../../../../core/services/logger.service';
import { SocialInteractionsService } from '../../../../core/services/social-interactions.service';
import { SocialPlatformService } from '../../../../core/services/social-platform.service';
import { ConfirmDialogService } from '../../../../core/services/confirm-dialog.service';
import { MediaService } from '../../../../core/services/media.service';
import { MediaCompressionService } from '../../../../core/services/media-compression.service';
import { BusinessOfferService } from '../../../../core/services/business-offer.service';
import { BusinessItemService } from '../../../../core/services/business-item.service';
import {
  BusinessOffer,
  BusinessItem,
  rowToBusinessOffer,
  rowToBusinessItem,
} from '../../../../core/services/social.mapper';
import { OpeningHoursEntry } from '../../../../core/models/app-user.model';
import { AppRoute } from '../../../../core/enums/route.enum';
import { TagCategory } from '../../../../core/enums/tag-category.enum';
import {
  BUSINESS_TAG_CATEGORIES,
  tagCategoryLabel,
} from '../../../../shared/constants/business-tags';
import { TagGradientPipe } from '../../../../shared/pipes/tag-gradient.pipe';
import { TagEmojiPipe } from '../../../../shared/pipes/tag-emoji.pipe';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { BusinessPostContentComponent } from '../../../post/components/business-post-content/business-post-content.component';
import { coverGradient, avatarBg } from '../../../../shared/utils/color.utils';
import { ThemeService, AppTheme } from '../../../../core/services/theme.service';
import {
  migrateLocalStorageKey,
  readLocalStorage,
  userStorageKey,
  writeLocalStorage,
} from '../../../../core/utils/local-storage.util';

type ProfileTab = 'posts' | 'saved' | 'settings';

interface ProfileSettings {
  locationSuggestions: boolean;
  postActivityNotifications: boolean;
}

interface NominatimAddress {
  state?: string;
  country?: string;
  state_district?: string;
  county?: string;
  city_district?: string;
  city?: string;
  town?: string;
  village?: string;
  suburb?: string;
  neighbourhood?: string;
}

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address: NominatimAddress;
}

interface HoodPick {
  state: string;
  country: string;
  district: string;
  place: string;
  lat: number;
  lng: number;
}

const HOOD_COOLDOWN_DAYS = 30;

const LEGACY_PROFILE_SETTINGS_KEY = 'tagmate.profileSettings';
const DEFAULT_PROFILE_SETTINGS: ProfileSettings = {
  locationSuggestions: true,
  postActivityNotifications: true,
};

const DEFAULT_OPENING_HOURS: OpeningHoursEntry[] = [
  { day: 'mon', open: '09:00', close: '18:00', closed: false },
  { day: 'tue', open: '09:00', close: '18:00', closed: false },
  { day: 'wed', open: '09:00', close: '18:00', closed: false },
  { day: 'thu', open: '09:00', close: '18:00', closed: false },
  { day: 'fri', open: '09:00', close: '18:00', closed: false },
  { day: 'sat', open: '09:00', close: '18:00', closed: false },
  { day: 'sun', open: '09:00', close: '18:00', closed: true },
];
const DAY_LABELS: Record<OpeningHoursEntry['day'], string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
};

@Component({
  selector: 'app-profile',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterLink,
    TagGradientPipe,
    TagEmojiPipe,
    EmptyStateComponent,
    BusinessPostContentComponent,
  ],
  templateUrl: './profile.html',
  styleUrls: ['./profile.scss'],
})
export class ProfilePage implements OnInit {
  private readonly tagRepo = inject(TAG_REPOSITORY);
  private readonly sessionService = inject(UserSessionService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly shared = inject(SharedStateService);
  private readonly logger = inject(LoggerService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly media = inject(MediaService);
  private readonly mediaCompression = inject(MediaCompressionService);
  private readonly offersApi = inject(BusinessOfferService);
  private readonly itemsApi = inject(BusinessItemService);
  protected readonly social = inject(SocialInteractionsService);
  protected readonly platform = inject(SocialPlatformService);
  protected readonly theme = inject(ThemeService);

  readonly availableThemes: { value: AppTheme; label: string }[] = [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
    { value: 'midnight', label: 'Midnight (OLED Black)' },
    { value: 'forest', label: 'Forest' },
    { value: 'sepia', label: 'Sepia' },
  ];

  readonly user$ = this.sessionService.user$;
  readonly coverGradient = coverGradient;
  readonly avatarBg = avatarBg;

  myTags = signal<Tag[]>([]);
  isLoading = signal(true);
  activeTab = signal<ProfileTab>('posts');
  editMode = signal(false);
  editName = signal('');
  editBio = signal('');
  editBusinessName = signal('');
  editBusinessPhone = signal('');
  editBusinessWebsite = signal('');
  editBusinessCategory = signal<TagCategory | ''>('');
  editBusinessImages = signal<string[]>([]);
  uploadingBusinessImage = signal(false);
  readonly maxBusinessImages = 30;
  editBusinessLogoUrl = signal('');
  uploadingBusinessLogo = signal(false);
  readonly businessTags = BUSINESS_TAG_CATEGORIES;
  readonly tagCategoryLabel = tagCategoryLabel;
  profileSaving = signal(false);

  // Business — cover image, opening hours, socials, Google Maps link
  editCoverImageUrl = signal('');
  uploadingCoverImage = signal(false);
  editOpeningHours = signal<OpeningHoursEntry[]>(DEFAULT_OPENING_HOURS);
  readonly dayLabels = DAY_LABELS;
  editGoogleMapsUrl = signal('');
  editSocialInstagram = signal('');
  editSocialFacebook = signal('');
  editSocialX = signal('');
  editSocialLinkedin = signal('');
  editSocialYoutube = signal('');
  editSocialWhatsapp = signal('');

  // Business — offers (auto-expire) and items/products/services
  businessOffers = signal<BusinessOffer[]>([]);
  businessItems = signal<BusinessItem[]>([]);
  newOfferImageUrl = signal('');
  newOfferTitle = signal('');
  newOfferDescription = signal('');
  newOfferValidUntil = signal('');
  uploadingOfferImage = signal(false);
  savingOffer = signal(false);
  newItemImageUrl = signal('');
  newItemName = signal('');
  newItemDescription = signal('');
  newItemPrice = signal('');
  newItemOfferPrice = signal('');
  uploadingItemImage = signal(false);
  savingItem = signal(false);
  deletingAccount = signal(false);
  allTags = signal<Tag[]>([]);
  settings = signal<ProfileSettings>(DEFAULT_PROFILE_SETTINGS);
  savedTags = computed(() =>
    this.allTags().filter((tag) => this.social.isSaved(tag) && !this.social.isHidden(tag)),
  );

  // Account Conversion for Guest
  convertEmail = signal('');
  convertPassword = signal('');
  convertUsername = signal('');
  convertError = signal('');
  convertLoading = signal(false);

  // Home hood editor
  hoodEditOpen = signal(false);
  hoodQuery = signal('');
  hoodResults = signal<NominatimResult[]>([]);
  hoodSearching = signal(false);
  hoodPick = signal<HoodPick | null>(null);
  hoodSaving = signal(false);
  private hoodSearchTimer: ReturnType<typeof setTimeout> | undefined;
  private hoodAbort?: AbortController;

  readonly currentHood = computed(() => this.sessionService.user()?.hood ?? null);
  readonly hoodDaysRemaining = computed(() => {
    const updated = this.currentHood()?.updatedAt;
    if (!updated) return 0;
    const nextAllowed = new Date(updated).getTime() + HOOD_COOLDOWN_DAYS * 86400_000;
    const diffMs = nextAllowed - Date.now();
    return diffMs > 0 ? Math.ceil(diffMs / 86400_000) : 0;
  });
  readonly canChangeHood = computed(() => this.hoodDaysRemaining() === 0);

  ngOnInit(): void {
    this.social.activateRealtime();
    this.settings.set(this.readProfileSettings());
    this.tagRepo
      .getAll()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (tags) => this.allTags.set(tags),
        error: (err) => this.logger.error('Failed to load saved posts', err),
      });

    this.sessionService.user$
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        switchMap((user) => {
          if (user.isGuest) {
            return of<Tag[]>([]);
          }
          this.isLoading.set(true);
          return this.tagRepo.getByUserId(user.uid!);
        }),
      )
      .subscribe({
        next: (tags) => {
          this.myTags.set(tags);
          this.isLoading.set(false);
        },
        error: (err) => {
          this.logger.error('Failed to load user tags', err);
          this.myTags.set([]);
          this.isLoading.set(false);
        },
      });

    // Drop a post immediately if it was deleted here or on any other page.
    this.social.postDeleted$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((deletedKey) => {
      this.allTags.update((tags) => tags.filter((t) => this.social.postKey(t) !== deletedKey));
      this.myTags.update((tags) => tags.filter((t) => this.social.postKey(t) !== deletedKey));
    });

    if (this.isBusinessAccount()) this.loadOffersAndItems();
  }

  private loadOffersAndItems(): void {
    const uid = this.sessionService.user()?.uid;
    if (!uid) return;
    this.offersApi
      .list(uid)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ data }) => this.businessOffers.set((data ?? []).map(rowToBusinessOffer)));
    this.itemsApi
      .list(uid)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ data }) => this.businessItems.set((data ?? []).map(rowToBusinessItem)));
  }

  async deleteTag(tag: Tag): Promise<void> {
    const deleted = await this.social.confirmAndDeletePost(tag);
    if (deleted) {
      const key = this.social.postKey(tag);
      this.allTags.update((tags) => tags.filter((t) => this.social.postKey(t) !== key));
      this.myTags.update((tags) => tags.filter((t) => this.social.postKey(t) !== key));
    }
  }

  setTab(tab: ProfileTab): void {
    this.activeTab.set(tab);
  }
  readonly isBusinessAccount = computed(
    () => this.sessionService.user()?.accountType === 'business',
  );
  readonly isGuestAccount = computed(() => this.sessionService.user()?.isGuest ?? true);
  /** Full AppUser (business logo/website/photos aren't on the stripped-down `user$` used for the header). */
  readonly currentUser = computed(() => this.sessionService.user());

  toggleEditProfile(): void {
    const opening = !this.editMode();
    if (opening) {
      const user = this.sessionService.user();
      this.editName.set(user?.name ?? '');
      this.editBio.set(user?.bio ?? '');
      this.editBusinessName.set(user?.businessName ?? '');
      this.editBusinessPhone.set(user?.businessPhone ?? '');
      this.editBusinessWebsite.set(user?.businessWebsite ?? '');
      this.editBusinessCategory.set((user?.businessCategory as TagCategory) ?? '');
      this.editBusinessImages.set(user?.businessImages ?? []);
      this.editBusinessLogoUrl.set(user?.avatarUrl ?? '');
      this.editCoverImageUrl.set(user?.coverImageUrl ?? '');
      this.editOpeningHours.set(user?.openingHours?.length ? user.openingHours : DEFAULT_OPENING_HOURS);
      this.editGoogleMapsUrl.set(user?.googleMapsUrl ?? '');
      this.editSocialInstagram.set(user?.socialInstagram ?? '');
      this.editSocialFacebook.set(user?.socialFacebook ?? '');
      this.editSocialX.set(user?.socialX ?? '');
      this.editSocialLinkedin.set(user?.socialLinkedin ?? '');
      this.editSocialYoutube.set(user?.socialYoutube ?? '');
      this.editSocialWhatsapp.set(user?.socialWhatsapp ?? '');
    }
    this.editMode.set(opening);
  }

  /** Toggles a day's `closed` flag in the opening-hours editor. */
  toggleOpeningDay(day: OpeningHoursEntry['day']): void {
    this.editOpeningHours.update((hours) =>
      hours.map((h) => (h.day === day ? { ...h, closed: !h.closed } : h)),
    );
  }

  setOpeningTime(day: OpeningHoursEntry['day'], field: 'open' | 'close', value: string): void {
    this.editOpeningHours.update((hours) =>
      hours.map((h) => (h.day === day ? { ...h, [field]: value } : h)),
    );
  }

  /** Uploads the account's profile picture — labeled "Business logo" for business
   *  accounts, "Profile photo" otherwise (see profile.html). */
  async onBusinessLogoSelect(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    const uid = this.sessionService.user()?.uid;
    if (!file || !uid || !file.type.startsWith('image/')) return;

    this.uploadingBusinessLogo.set(true);
    try {
      const { file: compressed } = await this.mediaCompression.compress(file);
      const ext = compressed.name.split('.').pop() ?? 'jpg';
      const path = `avatars/${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const url = await this.media.uploadFile(path, compressed);
      this.editBusinessLogoUrl.set(url);
    } catch {
      this.toast.show('Could not upload the photo.', 'warning');
    } finally {
      this.uploadingBusinessLogo.set(false);
    }
  }

  removeBusinessLogo(): void {
    this.editBusinessLogoUrl.set('');
  }

  /** Shared upload helper for cover/offer/item images — same compress+upload flow as the logo. */
  private async uploadBusinessImage(file: File, folder: string): Promise<string | null> {
    const uid = this.sessionService.user()?.uid;
    if (!uid || !file.type.startsWith('image/')) return null;
    const { file: compressed } = await this.mediaCompression.compress(file);
    const ext = compressed.name.split('.').pop() ?? 'jpg';
    const path = `${folder}/${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    return this.media.uploadFile(path, compressed);
  }

  async onCoverImageSelect(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.uploadingCoverImage.set(true);
    try {
      const url = await this.uploadBusinessImage(file, 'covers');
      if (url) this.editCoverImageUrl.set(url);
      else this.toast.show('Could not upload the cover image.', 'warning');
    } catch {
      this.toast.show('Could not upload the cover image.', 'warning');
    } finally {
      this.uploadingCoverImage.set(false);
    }
  }

  removeCoverImage(): void {
    this.editCoverImageUrl.set('');
  }

  selectBusinessCategory(tag: TagCategory): void {
    this.editBusinessCategory.set(tag);
  }

  async onBusinessImageSelect(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    const uid = this.sessionService.user()?.uid;
    if (!uid) return;

    for (const file of files) {
      if (this.editBusinessImages().length >= this.maxBusinessImages) {
        this.toast.show(`You can add up to ${this.maxBusinessImages} shop images.`, 'warning');
        break;
      }
      if (!file.type.startsWith('image/')) continue;

      this.uploadingBusinessImage.set(true);
      try {
        const { file: compressed } = await this.mediaCompression.compress(file);
        const ext = compressed.name.split('.').pop() ?? 'jpg';
        const path = `business/${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const url = await this.media.uploadFile(path, compressed);
        this.editBusinessImages.update((imgs) => [...imgs, url]);
      } catch {
        this.toast.show('Could not upload that image.', 'warning');
      } finally {
        this.uploadingBusinessImage.set(false);
      }
    }
  }

  removeBusinessImage(index: number): void {
    this.editBusinessImages.update((imgs) => imgs.filter((_, i) => i !== index));
  }

  async onOfferImageSelect(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.uploadingOfferImage.set(true);
    try {
      const url = await this.uploadBusinessImage(file, 'offers');
      if (url) this.newOfferImageUrl.set(url);
      else this.toast.show('Could not upload the offer image.', 'warning');
    } catch {
      this.toast.show('Could not upload the offer image.', 'warning');
    } finally {
      this.uploadingOfferImage.set(false);
    }
  }

  async addOffer(): Promise<void> {
    const uid = this.sessionService.user()?.uid;
    if (!uid || !this.newOfferTitle().trim() || !this.newOfferValidUntil()) {
      this.toast.show('An offer needs a title and a valid-until date.', 'warning');
      return;
    }
    this.savingOffer.set(true);
    try {
      const { data } = await firstValueFrom(
        this.offersApi.create({
          user_id: uid,
          image_url: this.newOfferImageUrl() || null,
          title: this.newOfferTitle().trim(),
          description: this.newOfferDescription().trim() || null,
          valid_until: this.newOfferValidUntil(),
        }),
      );
      if (data) this.businessOffers.update((offers) => [rowToBusinessOffer(data), ...offers]);
      this.newOfferImageUrl.set('');
      this.newOfferTitle.set('');
      this.newOfferDescription.set('');
      this.newOfferValidUntil.set('');
      this.toast.show('Offer added.', 'success');
    } catch (err) {
      this.logger.error('Failed to add offer', err);
      this.toast.show('Could not add the offer.', 'danger');
    } finally {
      this.savingOffer.set(false);
    }
  }

  async removeOffer(offer: BusinessOffer): Promise<void> {
    try {
      await firstValueFrom(this.offersApi.delete(offer.id));
      this.businessOffers.update((offers) => offers.filter((o) => o.id !== offer.id));
    } catch (err) {
      this.logger.error('Failed to remove offer', err);
      this.toast.show('Could not remove the offer.', 'danger');
    }
  }

  async onItemImageSelect(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.uploadingItemImage.set(true);
    try {
      const url = await this.uploadBusinessImage(file, 'items');
      if (url) this.newItemImageUrl.set(url);
      else this.toast.show('Could not upload the image.', 'warning');
    } catch {
      this.toast.show('Could not upload the image.', 'warning');
    } finally {
      this.uploadingItemImage.set(false);
    }
  }

  async addItem(): Promise<void> {
    const uid = this.sessionService.user()?.uid;
    if (!uid || !this.newItemName().trim()) {
      this.toast.show('An item needs a name.', 'warning');
      return;
    }
    this.savingItem.set(true);
    try {
      const { data } = await firstValueFrom(
        this.itemsApi.create({
          user_id: uid,
          image_url: this.newItemImageUrl() || null,
          name: this.newItemName().trim(),
          description: this.newItemDescription().trim() || null,
          price: this.newItemPrice() ? Number(this.newItemPrice()) : null,
          offer_price: this.newItemOfferPrice() ? Number(this.newItemOfferPrice()) : null,
        }),
      );
      if (data) this.businessItems.update((items) => [rowToBusinessItem(data), ...items]);
      this.newItemImageUrl.set('');
      this.newItemName.set('');
      this.newItemDescription.set('');
      this.newItemPrice.set('');
      this.newItemOfferPrice.set('');
      this.toast.show('Item added.', 'success');
    } catch (err) {
      this.logger.error('Failed to add item', err);
      this.toast.show('Could not add the item.', 'danger');
    } finally {
      this.savingItem.set(false);
    }
  }

  async removeItem(item: BusinessItem): Promise<void> {
    try {
      await firstValueFrom(this.itemsApi.delete(item.id));
      this.businessItems.update((items) => items.filter((i) => i.id !== item.id));
    } catch (err) {
      this.logger.error('Failed to remove item', err);
      this.toast.show('Could not remove the item.', 'danger');
    }
  }

  async saveProfile(): Promise<void> {
    if (!this.editName().trim()) {
      this.toast.show('Display name is required.', 'warning');
      return;
    }
    if (this.isBusinessAccount() && !this.editBusinessCategory()) {
      this.toast.show('Pick a business category.', 'warning');
      return;
    }
    if (this.isBusinessAccount() && this.editBusinessImages().length < 1) {
      this.toast.show('Add at least one shop image.', 'warning');
      return;
    }
    this.profileSaving.set(true);
    let saved = await this.platform.updateOwnProfile(this.editName(), this.editBio());
    if (saved && this.isBusinessAccount()) {
      saved = await this.sessionService.updateBusinessProfile({
        businessName: this.editBusinessName(),
        businessPhone: this.editBusinessPhone(),
        businessWebsite: this.editBusinessWebsite(),
        businessCategory: this.editBusinessCategory(),
        businessImages: this.editBusinessImages(),
        avatarUrl: this.editBusinessLogoUrl(),
        coverImageUrl: this.editCoverImageUrl(),
        openingHours: this.editOpeningHours(),
        googleMapsUrl: this.editGoogleMapsUrl(),
        socialInstagram: this.editSocialInstagram(),
        socialFacebook: this.editSocialFacebook(),
        socialX: this.editSocialX(),
        socialLinkedin: this.editSocialLinkedin(),
        socialYoutube: this.editSocialYoutube(),
        socialWhatsapp: this.editSocialWhatsapp(),
      });
    } else if (saved) {
      // Personal accounts don't go through updateBusinessProfile, but the
      // profile photo picker above is shared by both — persist it here.
      saved = await this.sessionService.updateAvatarUrl(this.editBusinessLogoUrl());
    }
    this.profileSaving.set(false);
    if (saved) {
      this.editMode.set(false);
      this.toast.show('Profile saved.', 'success');
    }
  }
  saveSettings(): void {
    writeLocalStorage(this.profileSettingsKey(), this.settings());
    this.toast.show('Settings saved.', 'success');
  }
  savedCount(): number {
    return this.savedTags().length;
  }

  updateSetting<K extends keyof ProfileSettings>(key: K, value: ProfileSettings[K]): void {
    this.settings.update((settings) => {
      const next = { ...settings, [key]: value };
      writeLocalStorage(this.profileSettingsKey(), next);
      return next;
    });
  }

  /** Not expired and not manually ended — same rule the live feeds use.
   *  Step 5.A: expiry is anchored on publication time, not draft/creation time. */
  private isPostLive(tag: Tag): boolean {
    if (tag.currentStatus && tag.currentStatus !== 'active') return false;
    const anchor = tag.publishedAt ?? tag.createdAt;
    const anchorMs = new Date(anchor).getTime();
    if (Number.isNaN(anchorMs)) return true;
    return anchorMs + tag.expiresIn * 60_000 > Date.now();
  }

  /** True for a normal published post — draft/scheduled posts get their own
   *  section instead of mixing into Active/Expired (Step 5.A). */
  private isPublished(tag: Tag): boolean {
    return !tag.publishStatus || tag.publishStatus === 'published';
  }

  readonly activePosts = computed(() =>
    this.myTags().filter((t) => this.isPublished(t) && this.isPostLive(t)),
  );
  readonly expiredPosts = computed(() =>
    this.myTags().filter((t) => this.isPublished(t) && !this.isPostLive(t)),
  );
  /** Step 5.A: the owner's own unfinished posts — never shown to anyone else. */
  readonly draftPosts = computed(() => this.myTags().filter((t) => t.publishStatus === 'draft'));
  readonly scheduledPosts = computed(() =>
    this.myTags().filter((t) => t.publishStatus === 'scheduled'),
  );

  /** "Continue editing" on a draft/scheduled post — routes back into the full composer. */
  continueEditing(tag: Tag): void {
    if (!tag.id) return;
    void this.router.navigate(['/post'], { queryParams: { draftId: tag.id } });
  }

  private patchMyTag(id: string, patch: Partial<Tag>): void {
    this.myTags.update((tags) => tags.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  async extendPost(tag: Tag, addMinutes: number): Promise<void> {
    if (!tag.id) return;
    try {
      const updated = await firstValueFrom(
        this.tagRepo.update(tag.id, {
          expiresIn: tag.expiresIn + addMinutes,
          currentStatus: 'active',
        }),
      );
      this.patchMyTag(tag.id, updated);
      this.toast.show('Post extended.', 'success');
    } catch (err) {
      this.logger.error('Failed to extend post', err);
      this.toast.show('Could not extend the post.', 'danger');
    }
  }

  async markSoldOrFull(tag: Tag): Promise<void> {
    const ok = await this.platform.setPostStatus(tag, 'resolved', '');
    if (ok && tag.id) {
      this.patchMyTag(tag.id, { currentStatus: 'resolved' });
      this.toast.show('Marked sold/full.', 'success');
    }
  }

  async endPostNow(tag: Tag): Promise<void> {
    const ok = await this.platform.setPostStatus(tag, 'cancelled', '');
    if (ok && tag.id) {
      this.patchMyTag(tag.id, { currentStatus: 'cancelled' });
      this.toast.show('Post ended.', 'success');
    }
  }

  /**
   * Prefills the composer from an old post (text/price/availability/tag/etc.)
   * and jumps straight to the Details step so the owner only has to tweak
   * what changed — price, availability, expiry — then publish as a NEW post.
   * Photos aren't carried over (the old ones are already-uploaded URLs, not
   * re-uploadable local files) — the owner re-attaches them if needed.
   */
  /**
   * Prefills the composer from an old post and republishes it as a NEW post.
   * `resumeStep: 'preview'` → "Post Again" (nothing to review, one tap to publish);
   * `resumeStep: 'details'` → "Edit & Post" (review/tweak price, availability, etc. first).
   * Photos aren't carried over (the old ones are already-uploaded URLs, not
   * re-uploadable local files) — the owner re-attaches them if needed.
   */
  private prefillFromPost(tag: Tag, resumeStep: 'details' | 'preview'): void {
    this.shared.updateCoordinates(tag.lat, tag.lng);
    this.shared.updateText(tag.hoodId || tag.highlight || 'Selected post');
    this.shared.updateRegion(tag.state ?? '', tag.country ?? '');
    this.shared.locationType.set(tag.locationType ?? 'pinpoint');
    this.shared.postDraft.set({
      postType: tag.postType ?? 'personal',
      headline: tag.highlight,
      expiresIn: tag.expiresIn,
      tag: tag.tag,
      intent: tag.intent ?? '',
      price: tag.price?.toString() ?? '',
      originalPrice: tag.originalPrice?.toString() ?? '',
      availabilityNote: tag.availabilityNote ?? '',
      cta: tag.cta ?? 'message',
      productLink: tag.productLink ?? '',
      isEvent: !!(tag.eventStart || tag.eventEnd),
      eventStart: tag.eventStart ?? '',
      eventEnd: tag.eventEnd ?? '',
      pollOptions: tag.pollOptions?.length ? [...tag.pollOptions] : ['', ''],
      templateValues: {},
      media: [],
      resumeStep,
    });
    this.toast.show('Pre-filled from your last post — re-attach photos if needed.', 'success');
    void this.router.navigate(['/post']);
  }

  postAgain(tag: Tag): void {
    this.prefillFromPost(tag, 'preview');
  }

  editAndPost(tag: Tag): void {
    this.prefillFromPost(tag, 'details');
  }

  viewOnMap(tag: Tag): void {
    this.shared.updateCoordinates(tag.lat, tag.lng);
    this.shared.updateText(tag.highlight || tag.hoodId || 'Selected post');
    void this.router.navigate([AppRoute.Hood]);
  }

  editPost(tag: Tag): void {
    const key = this.social.postKey(tag);
    void this.router.navigate(['/post/edit', key]);
  }

  async logout(): Promise<void> {
    try {
      await this.sessionService.logout();
      this.toast.show('Logged out.', 'success');
      await this.router.navigate([AppRoute.Login]);
    } catch (err) {
      this.logger.error('Logout failed', err);
      this.toast.show('Could not log out.', 'danger');
    }
  }

  async deleteAccount(): Promise<void> {
    if (this.deletingAccount()) return;
    const confirmed = await this.confirmDialog.confirm({
      title: 'Delete your account?',
      message: "This permanently deletes your profile, posts, and messages. This can't be undone.",
      confirmText: 'Delete Account',
      cancelText: 'Keep Account',
      danger: true,
    });
    if (!confirmed) return;

    this.deletingAccount.set(true);
    try {
      await this.sessionService.deleteAccount();
      this.toast.show('Your account has been deleted.', 'success');
      await this.router.navigate([AppRoute.Login]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not delete your account.';
      this.logger.error('Delete account failed', err);
      this.toast.show(message, 'danger');
    } finally {
      this.deletingAccount.set(false);
    }
  }

  private profileSettingsKey(): string {
    return userStorageKey(this.sessionService.user()?.uid ?? 'guest', 'profile-settings');
  }

  private readProfileSettings(): ProfileSettings {
    const key = this.profileSettingsKey();
    migrateLocalStorageKey(LEGACY_PROFILE_SETTINGS_KEY, key);
    return {
      ...DEFAULT_PROFILE_SETTINGS,
      ...readLocalStorage<Partial<ProfileSettings>>(key, {}),
    };
  }

  async convertAccount(): Promise<void> {
    if (!this.convertEmail().trim() || !this.convertPassword() || !this.convertUsername().trim()) {
      this.convertError.set('Please fill out all fields.');
      return;
    }
    this.convertError.set('');
    this.convertLoading.set(true);
    try {
      const res = await this.sessionService.convertGuestToPermanent(
        this.convertEmail().trim(),
        this.convertPassword(),
        this.convertUsername().trim(),
      );
      if (res.ok) {
        this.toast.show('Account converted successfully!', 'success');
        this.editMode.set(false);
      } else {
        this.convertError.set(res.message);
        this.toast.show(res.message, 'danger');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Conversion failed';
      this.convertError.set(message);
      this.toast.show(message, 'danger');
    } finally {
      this.convertLoading.set(false);
    }
  }

  openHoodEditor(): void {
    if (!this.canChangeHood()) {
      this.toast.show(
        `You can change your home hood again in ${this.hoodDaysRemaining()} days.`,
        'warning',
      );
      return;
    }
    this.hoodEditOpen.set(true);
    this.hoodQuery.set('');
    this.hoodResults.set([]);
    this.hoodPick.set(null);
  }

  closeHoodEditor(): void {
    this.hoodEditOpen.set(false);
    this.hoodQuery.set('');
    this.hoodResults.set([]);
    this.hoodPick.set(null);
    this.hoodAbort?.abort();
    clearTimeout(this.hoodSearchTimer);
  }

  onHoodInput(value: string): void {
    this.hoodQuery.set(value);
    this.hoodPick.set(null);
    clearTimeout(this.hoodSearchTimer);
    const q = value.trim();
    if (q.length < 2) {
      this.hoodResults.set([]);
      this.hoodSearching.set(false);
      return;
    }
    this.hoodSearchTimer = setTimeout(() => this.searchHood(q), 350);
  }

  private searchHood(q: string): void {
    this.hoodAbort?.abort();
    this.hoodAbort = new AbortController();
    const { signal } = this.hoodAbort;
    this.hoodSearching.set(true);

    fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&addressdetails=1&limit=8`,
      { signal, headers: { 'Accept-Language': 'en' } },
    )
      .then(async (res) => {
        const results = (await res.json()) as NominatimResult[];
        if (signal.aborted) return;
        const filtered = results.filter(
          (r) => !!r.address?.state && !!ProfilePage.districtOf(r.address),
        );
        this.hoodResults.set(filtered);
        this.hoodSearching.set(false);
      })
      .catch(() => {
        if (!signal.aborted) this.hoodSearching.set(false);
      });
  }

  private static districtOf(addr: NominatimAddress): string {
    return addr.state_district || addr.county || addr.city_district || addr.city || addr.town || '';
  }

  selectHood(r: NominatimResult): void {
    const addr = r.address ?? {};
    const district = ProfilePage.districtOf(addr);
    const rawPlace =
      addr.suburb ||
      addr.neighbourhood ||
      addr.village ||
      addr.town ||
      addr.city ||
      r.display_name.split(',')[0]?.trim() ||
      '';
    const place = rawPlace && rawPlace !== district ? rawPlace : '';

    this.hoodPick.set({
      state: addr.state || '',
      country: addr.country || '',
      district,
      place,
      lat: Number(r.lat),
      lng: Number(r.lon),
    });
    this.hoodQuery.set(place ? `${place}, ${district}` : district);
    this.hoodResults.set([]);
  }

  async saveHood(): Promise<void> {
    const pick = this.hoodPick();
    if (!pick || !pick.state || !pick.district) {
      this.toast.show('Pick a location with a state and district first.', 'warning');
      return;
    }
    this.hoodSaving.set(true);
    try {
      const res = await this.sessionService.updateHomeHood({
        state: pick.state,
        country: pick.country,
        district: pick.district,
        place: pick.place || undefined,
        lat: pick.lat,
        lng: pick.lng,
      });
      if (res.ok) {
        this.toast.show('Home hood updated.', 'success');
        this.closeHoodEditor();
      } else {
        const msg = /HOME_HOOD_COOLDOWN/i.test(res.message ?? '')
          ? `You can only change your home hood once every ${HOOD_COOLDOWN_DAYS} days.`
          : (res.message ?? 'Could not update home hood.');
        this.toast.show(msg, 'danger');
      }
    } finally {
      this.hoodSaving.set(false);
    }
  }
}
