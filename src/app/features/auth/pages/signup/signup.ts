import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  HostListener,
  signal,
  computed,
  inject,
  DestroyRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { UserSessionService } from '../../../../core/services/user-session.service';
import { ThemeService } from '../../../../core/services/theme.service';
import { MediaService } from '../../../../core/services/media.service';
import { MediaCompressionService } from '../../../../core/services/media-compression.service';
import { AccountType } from '../../../../core/models/app-user.model';
import { isValidUsername, normalizeUsername } from '../../../../core/utils/auth-identifier.utils';
import { TagCategory } from '../../../../core/enums/tag-category.enum';
import {
  BUSINESS_TAG_CATEGORIES,
  tagCategoryLabel,
} from '../../../../shared/constants/business-tags';
import { TagEmojiPipe } from '../../../../shared/pipes/tag-emoji.pipe';

const MIN_AGE = 13;
const MAX_SHOP_IMAGES = 5;
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

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

@Component({
  selector: 'app-signup',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, RouterLink, TagEmojiPipe],
  templateUrl: './signup.html',
  styleUrls: ['./signup.scss'],
})
export class SignupPage implements OnInit {
  email = signal('');
  password = signal('');
  fullName = signal('');
  username = signal('');

  /** Personal is the default — business accounts also give a shop/business name shown on their posts. */
  accountType = signal<AccountType>('personal');
  businessName = signal('');
  /** Once confirmed via the popup dialog, the name is locked for the rest of signup. */
  businessNameConfirmed = signal(false);
  showNameConfirmDialog = signal(false);
  /** Optional — shown on business post cards when set. */
  businessPhone = signal('');
  businessWebsite = signal('');
  /** 'generated' = auto-created workers.dev link (default once name is confirmed); 'manual' = user's own URL. */
  websiteMode = signal<'generated' | 'manual'>('generated');
  generatingWebsite = signal(false);
  websiteGenError = signal('');
  websiteVerifying = signal(false);
  websiteVerifyStatus = signal<'idle' | 'ok' | 'fail'>('idle');
  private websiteVerifyTimer: ReturnType<typeof setTimeout> | undefined;
  private websiteVerifyAbort?: AbortController;
  /** Staged in memory — the account doesn't exist yet, so upload happens after signup() succeeds. */
  shopImages = signal<{ file: File; previewUrl: string }[]>([]);
  readonly maxShopImages = MAX_SHOP_IMAGES;
  /** Optional single business logo — also staged in memory until signup() succeeds. */
  businessLogo = signal<{ file: File; previewUrl: string } | null>(null);
  /** Required for business accounts — every post they make uses this tag, so
   *  there's no per-post category picker anymore (see post.ts). */
  businessCategory = signal<TagCategory | ''>('');
  readonly businessTags = BUSINESS_TAG_CATEGORIES;
  readonly tagCategoryLabel = tagCategoryLabel;
  /** Business accounts give a founding year instead of a personal birthday (see the final step). */
  businessEstablishedYear = signal('');

  selectBusinessCategory(tag: TagCategory): void {
    this.businessCategory.set(tag);
  }

  birthMonth = signal('');
  birthDay = signal('');
  birthYear = signal('');

  hoodQuery = signal('');
  hoodResults = signal<NominatimResult[]>([]);
  hoodSearching = signal(false);
  hoodOpen = signal(false);
  hoodPick = signal<HoodPick | null>(null);
  private hoodSearchTimer: ReturnType<typeof setTimeout> | undefined;
  private hoodAbort?: AbortController;

  error = signal('');
  loading = signal(false);
  showPassword = signal(false);

  /** Set once signup succeeds but the account still needs email confirmation. */
  awaitingEmailConfirmation = signal(false);
  resendingEmail = signal(false);
  resendSent = signal(false);
  resendError = signal('');
  /** 6-digit code from the confirmation email — confirmed in place, no navigating away. */
  otpCode = signal('');
  verifyingOtp = signal(false);
  otpError = signal('');

  usernameChecking = signal(false);
  usernameTaken = signal(false);
  private usernameCheckTimer: ReturnType<typeof setTimeout> | undefined;

  readonly months = MONTHS;
  readonly days = Array.from({ length: 31 }, (_, i) => i + 1);
  readonly years = (() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 100 }, (_, i) => currentYear - i);
  })();

  /** Internal step is 1 (account) / 2 (business identity, business only) / 3
   *  (business category, business only) / 4 (business photos + website, business
   *  only) / 5 (birthday + location — relabeled "business details" for business
   *  accounts). Personal accounts skip straight from 1 to 5 — see
   *  nextStep()/prevStep() — so the indicator shows 2 nodes for them and 5 for
   *  business. Split into several short business steps so each screen fits
   *  without scrolling. */
  readonly step = signal(1);
  readonly totalSteps = computed(() => (this.accountType() === 'business' ? 5 : 2));
  /** The step number to highlight in the indicator (collapses the skipped business steps for personal accounts). */
  readonly stepNumber = computed(() => {
    if (this.accountType() === 'business') return this.step();
    return this.step() === 5 ? 2 : 1;
  });
  readonly stepIndicators = computed(() =>
    Array.from({ length: this.totalSteps() }, (_, i) => i + 1),
  );

  isPasswordStrong(pw: string): boolean {
    return pw.length >= 8 && /[A-Z]/.test(pw) && /[a-z]/.test(pw) && /[0-9]/.test(pw);
  }

  readonly canProceedStep1 = computed(
    () =>
      !!this.email() &&
      this.isPasswordStrong(this.password()) &&
      !!this.fullName().trim() &&
      isValidUsername(this.username()) &&
      !this.usernameTaken() &&
      !this.usernameChecking(),
  );

  /** Step 2: business identity (name confirmed — phone/logo are optional). */
  readonly canProceedBusinessIdentityStep = computed(() => this.businessNameConfirmed());

  /** Step 3: business category. */
  readonly canProceedCategoryStep = computed(() => !!this.businessCategory());

  /** Step 4: shop photos (required) + website (required). */
  readonly canProceedBusinessMediaStep = computed(() => {
    if (this.shopImages().length < 1) return false;
    if (this.generatingWebsite()) return false;
    const website = this.businessWebsite().trim();
    if (!website) return false;
    if (this.websiteMode() === 'manual') return SignupPage.isValidUrl(website);
    return true;
  });

  private static isValidUrl(value: string): boolean {
    try {
      const url = new URL(value);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }

  selectAccountType(type: AccountType): void {
    this.accountType.set(type);
    if (type === 'personal') this.businessCategory.set('');
  }

  onShopImageSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';

    for (const file of files) {
      if (this.shopImages().length >= MAX_SHOP_IMAGES) {
        this.error.set(`You can add up to ${MAX_SHOP_IMAGES} shop images.`);
        break;
      }
      if (!file.type.startsWith('image/')) continue;
      const previewUrl = URL.createObjectURL(file);
      this.shopImages.update((imgs) => [...imgs, { file, previewUrl }]);
    }
  }

  removeShopImage(index: number): void {
    this.shopImages.update((imgs) => imgs.filter((_, i) => i !== index));
  }

  onBusinessLogoSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || !file.type.startsWith('image/')) return;
    this.businessLogo.set({ file, previewUrl: URL.createObjectURL(file) });
  }

  removeBusinessLogo(): void {
    this.businessLogo.set(null);
  }

  private nameConfirmTrigger: HTMLElement | null = null;

  requestConfirmBusinessName(): void {
    if (!this.businessName().trim() || this.businessNameConfirmed()) return;
    this.nameConfirmTrigger =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.showNameConfirmDialog.set(true);
  }

  private closeNameConfirmDialog(): void {
    this.showNameConfirmDialog.set(false);
    const target = this.nameConfirmTrigger;
    this.nameConfirmTrigger = null;
    queueMicrotask(() => target?.focus());
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.showNameConfirmDialog()) this.cancelNameConfirm();
  }

  cancelNameConfirm(): void {
    this.closeNameConfirmDialog();
  }

  async confirmBusinessName(): Promise<void> {
    this.closeNameConfirmDialog();
    this.businessNameConfirmed.set(true);
    await this.generateWebsite();
  }

  editBusinessName(): void {
    this.businessNameConfirmed.set(false);
    this.websiteMode.set('generated');
    this.websiteGenError.set('');
    this.websiteVerifyStatus.set('idle');
    this.businessWebsite.set('');
  }

  private async generateWebsite(): Promise<void> {
    this.generatingWebsite.set(true);
    this.websiteGenError.set('');
    try {
      const website = await this.session.generateBusinessWebsite(this.businessName().trim());
      if (this.destroyed) return;
      this.businessWebsite.set(website);
      this.websiteMode.set('generated');
    } catch (error) {
      if (!this.destroyed) {
        this.websiteGenError.set(
          error instanceof Error ? error.message : 'Could not generate a website link.',
        );
      }
    } finally {
      if (!this.destroyed) this.generatingWebsite.set(false);
    }
  }

  useOwnWebsite(): void {
    this.websiteMode.set('manual');
    this.businessWebsite.set('');
    this.websiteVerifyStatus.set('idle');
    this.websiteGenError.set('');
  }

  async useGeneratedWebsite(): Promise<void> {
    this.websiteMode.set('generated');
    this.websiteVerifyStatus.set('idle');
    if (!this.businessWebsite().trim()) await this.generateWebsite();
  }

  onManualWebsiteInput(value: string): void {
    this.businessWebsite.set(value);
    this.websiteVerifyStatus.set('idle');

    clearTimeout(this.websiteVerifyTimer);
    const candidate = value.trim();
    if (!SignupPage.isValidUrl(candidate)) return;

    this.websiteVerifyTimer = setTimeout(() => this.verifyWebsite(candidate), 500);
  }

  private verifyWebsite(url: string): void {
    this.websiteVerifyAbort?.abort();
    this.websiteVerifyAbort = new AbortController();
    const { signal } = this.websiteVerifyAbort;
    this.websiteVerifying.set(true);

    const timeout = setTimeout(() => this.websiteVerifyAbort?.abort(), 6000);

    fetch(url, { signal, mode: 'no-cors', cache: 'no-store' })
      .then(() => {
        if (signal.aborted || this.businessWebsite().trim() !== url) return;
        this.websiteVerifyStatus.set('ok');
      })
      .catch(() => {
        if (this.businessWebsite().trim() !== url) return;
        this.websiteVerifyStatus.set('fail');
      })
      .finally(() => {
        clearTimeout(timeout);
        if (this.businessWebsite().trim() === url) this.websiteVerifying.set(false);
      });
  }

  readonly canSubmit = computed(() => {
    const pick = this.hoodPick();
    const hoodOk = !!pick && !!pick.state && !!pick.country && !!pick.district;
    if (this.loading()) return false;
    if (this.accountType() === 'business') {
      return (
        hoodOk &&
        !!this.businessEstablishedYear() &&
        this.canProceedBusinessIdentityStep() &&
        this.canProceedCategoryStep() &&
        this.canProceedBusinessMediaStep()
      );
    }
    return hoodOk && !!this.birthMonth() && !!this.birthDay() && !!this.birthYear();
  });

  /**
   * Re-checks the *current* step's own gate before advancing — the disabled
   * attribute on the Continue button is the usual guard, but a fast enough
   * double-click can fire two `nextStep()` calls before Angular re-renders
   * that binding, letting the second call skip a whole step. This makes
   * `nextStep()` itself the source of truth, not just button timing.
   */
  nextStep(): void {
    if (this.step() === 1) {
      if (!this.canProceedStep1()) return;
      this.step.set(this.accountType() === 'business' ? 2 : 5);
    } else if (this.step() === 2) {
      if (!this.canProceedBusinessIdentityStep()) return;
      this.step.set(3);
    } else if (this.step() === 3) {
      if (!this.canProceedCategoryStep()) return;
      this.step.set(4);
    } else if (this.step() === 4) {
      if (!this.canProceedBusinessMediaStep()) return;
      this.step.set(5);
    }
  }

  prevStep(): void {
    if (this.step() === 5) {
      this.step.set(this.accountType() === 'business' ? 4 : 1);
    } else if (this.step() === 4) {
      this.step.set(3);
    } else if (this.step() === 3) {
      this.step.set(2);
    } else if (this.step() === 2) {
      this.step.set(1);
    }
  }

  private readonly session = inject(UserSessionService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly media = inject(MediaService);
  private readonly mediaCompression = inject(MediaCompressionService);
  public readonly theme = inject(ThemeService);

  private destroyed = false;

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
    });
  }

  ngOnInit(): void {
    this.session.user$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((user) => {
      if (this.destroyed) return;
      if (!user.isGuest) this.router.navigateByUrl('/feed-beta');
    });
  }

  onHoodInput(value: string): void {
    this.hoodQuery.set(value);
    this.hoodOpen.set(true);
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
        // Keep any result that has a state, a country, AND some district-like
        // admin level. Nominatim's tagging varies by country — for big metros
        // the district often sits in `city` (e.g. Delhi) or `city_district`,
        // not `state_district`, so we fall back through several fields.
        const filtered = results.filter(
          (r) => !!r.address?.state && !!r.address?.country && !!SignupPage.districtOf(r.address),
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
    const district = SignupPage.districtOf(addr);
    // The "sub place" (optional) — only meaningful if it's finer than the
    // district itself.
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
    this.hoodOpen.set(false);
  }

  clearHood(): void {
    this.hoodPick.set(null);
    this.hoodQuery.set('');
    this.hoodResults.set([]);
  }

  onUsernameInput(value: string): void {
    const candidate = normalizeUsername(value);
    this.username.set(candidate);
    this.usernameTaken.set(false);

    clearTimeout(this.usernameCheckTimer);
    if (!isValidUsername(candidate)) return;

    this.usernameCheckTimer = setTimeout(async () => {
      this.usernameChecking.set(true);
      try {
        const taken = await this.session.isUsernameTaken(candidate);
        if (this.username() === candidate) this.usernameTaken.set(taken);
      } catch {
        if (this.username() === candidate) {
          this.error.set('Could not check username availability. Please try again.');
        }
      } finally {
        this.usernameChecking.set(false);
      }
    }, 400);
  }

  /** Uploads the images staged during step 2, now that the account (and its session) exist. */
  private async uploadShopImages(uid: string): Promise<void> {
    try {
      const urls: string[] = [];
      for (const item of this.shopImages()) {
        const { file } = await this.mediaCompression.compress(item.file);
        const ext = file.name.split('.').pop() ?? 'jpg';
        const path = `business/${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        urls.push(await this.media.uploadFile(path, file));
      }
      await this.session.updateBusinessImages(urls, uid);
    } catch {
      // Best-effort — the account is already created; images can be added again from profile settings.
    }
  }

  /** Uploads the logo staged during step 2, now that the account (and its session) exist. */
  private async uploadBusinessLogo(uid: string): Promise<void> {
    const logo = this.businessLogo();
    if (!logo) return;
    try {
      const { file } = await this.mediaCompression.compress(logo.file);
      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = `avatars/${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const url = await this.media.uploadFile(path, file);
      await this.session.updateAvatarUrl(url, uid);
    } catch {
      // Best-effort — the account is already created; the logo can be added again from profile settings.
    }
  }

  private isOldEnough(): boolean {
    const month = Number(this.birthMonth());
    const day = Number(this.birthDay());
    const year = Number(this.birthYear());
    if (!month || !day || !year) return false;

    const birthDate = new Date(year, month - 1, day);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const hasHadBirthdayThisYear =
      today.getMonth() > birthDate.getMonth() ||
      (today.getMonth() === birthDate.getMonth() && today.getDate() >= birthDate.getDate());
    if (!hasHadBirthdayThisYear) age--;

    return age >= MIN_AGE;
  }

  resetSignupForm(): void {
    this.awaitingEmailConfirmation.set(false);
    this.error.set('');
    this.resendError.set('');
    this.resendSent.set(false);
    this.step.set(1);
    this.loading.set(false);
  }

  async signup(): Promise<void> {
    this.error.set('');

    const isBusiness = this.accountType() === 'business';
    if (!isBusiness && !this.isOldEnough()) {
      this.error.set(`You must be at least ${MIN_AGE} years old to sign up.`);
      return;
    }

    this.loading.set(true);
    try {
      // Business accounts give a founding year instead of a personal birthday
      // (no DB column stores this — it's only carried in auth metadata) —
      // Jan 1 is a harmless placeholder day/month, only the year is real.
      const birthday = isBusiness
        ? `${this.businessEstablishedYear()}-01-01`
        : `${this.birthYear()}-${String(this.birthMonth()).padStart(2, '0')}-${String(this.birthDay()).padStart(2, '0')}`;

      const pick = this.hoodPick();
      if (!pick) {
        this.error.set('Please pick your home location.');
        return;
      }

      const res = await Promise.race([
        this.session.signup(this.email(), this.password(), {
          username: this.username().trim(),
          fullName: this.fullName().trim(),
          birthday,
          hood: {
            state: pick.state,
            country: pick.country,
            district: pick.district,
            place: pick.place || undefined,
            lat: pick.lat,
            lng: pick.lng,
          },
          accountType: this.accountType(),
          businessName: this.accountType() === 'business' ? this.businessName().trim() : undefined,
          businessPhone:
            this.accountType() === 'business'
              ? this.businessPhone().trim() || undefined
              : undefined,
          businessWebsite:
            this.accountType() === 'business'
              ? this.businessWebsite().trim() || undefined
              : undefined,
          businessCategory:
            this.accountType() === 'business' ? this.businessCategory() || undefined : undefined,
          businessEstablishedYear:
            this.accountType() === 'business'
              ? Number(this.businessEstablishedYear()) || undefined
              : undefined,
        }),
        this.timeoutPromise(),
      ]);

      if (this.destroyed) return;

      if (res.ok) {
        if (res.needsEmailConfirmation) {
          this.awaitingEmailConfirmation.set(true);
        } else {
          if (this.accountType() === 'business' && this.shopImages().length) {
            await this.uploadShopImages(res.uid);
          }
          if (this.accountType() === 'business' && this.businessLogo()) {
            await this.uploadBusinessLogo(res.uid);
          }
          this.router.navigateByUrl('/feed-beta');
        }
      } else {
        if ('code' in res && res.code === 'username_taken') this.usernameTaken.set(true);
        this.error.set(res.message ?? 'Signup failed');
      }
    } catch (error) {
      if (!this.destroyed) {
        this.error.set(
          error instanceof Error
            ? error.message
            : 'Could not validate your account details. Please try again.',
        );
      }
    } finally {
      if (!this.destroyed) {
        this.loading.set(false);
      }
    }
  }

  async resendConfirmationEmail(): Promise<void> {
    if (this.resendingEmail()) return;
    this.resendError.set('');
    this.resendingEmail.set(true);
    try {
      const ok = await this.session.resendConfirmationEmail(this.email());
      if (ok) {
        this.resendSent.set(true);
      } else {
        this.resendError.set("Couldn't resend right now — try again in a moment.");
      }
    } finally {
      this.resendingEmail.set(false);
    }
  }

  async confirmOtp(): Promise<void> {
    if (this.verifyingOtp()) return;
    const code = this.otpCode().trim();
    if (!code) {
      this.otpError.set('Enter the code from your email.');
      return;
    }

    this.otpError.set('');
    this.verifyingOtp.set(true);
    try {
      const res = await this.session.confirmSignupOtp(this.email(), code);
      if (this.destroyed) return;

      if (!res.ok) {
        this.otpError.set(res.message ?? "That code didn't work — try again.");
        return;
      }

      // Confirmed in place — shopImages()/businessLogo() are still whatever
      // was staged in step 3, since we never navigated away for this.
      if (this.accountType() === 'business' && this.shopImages().length) {
        await this.uploadShopImages(res.uid);
      }
      if (this.accountType() === 'business' && this.businessLogo()) {
        await this.uploadBusinessLogo(res.uid);
      }
      this.router.navigateByUrl('/feed-beta');
    } catch (error) {
      if (!this.destroyed) {
        this.otpError.set(error instanceof Error ? error.message : 'Could not verify that code.');
      }
    } finally {
      if (!this.destroyed) this.verifyingOtp.set(false);
    }
  }

  private timeoutPromise(): Promise<{ ok: false; message: string }> {
    return new Promise((resolve) =>
      setTimeout(() => resolve({ ok: false, message: 'Request timeout (8s)' }), 8000),
    );
  }
}
