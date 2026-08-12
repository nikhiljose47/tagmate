import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
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
import { AccountType } from '../../../../core/models/app-user.model';
import { isValidUsername, normalizeUsername } from '../../../../core/utils/auth-identifier.utils';

const MIN_AGE = 13;
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
  imports: [CommonModule, FormsModule, RouterLink],
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
  /** Optional — shown on business post cards when set. */
  businessPhone = signal('');
  businessWebsite = signal('');

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

  usernameChecking = signal(false);
  usernameTaken = signal(false);
  private usernameCheckTimer: ReturnType<typeof setTimeout> | undefined;

  readonly months = MONTHS;
  readonly days = Array.from({ length: 31 }, (_, i) => i + 1);
  readonly years = (() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 100 }, (_, i) => currentYear - i);
  })();

  readonly step = signal(1);
  readonly totalSteps = 2;

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
      !this.usernameChecking() &&
      (this.accountType() === 'personal' || !!this.businessName().trim()),
  );

  selectAccountType(type: AccountType): void {
    this.accountType.set(type);
  }

  readonly canSubmit = computed(() => {
    const pick = this.hoodPick();
    return (
      !!this.birthMonth() &&
      !!this.birthDay() &&
      !!this.birthYear() &&
      !!pick &&
      !!pick.state &&
      !!pick.district &&
      !this.loading()
    );
  });

  nextStep(): void {
    if (this.step() < this.totalSteps) this.step.update((s) => s + 1);
  }

  prevStep(): void {
    if (this.step() > 1) this.step.update((s) => s - 1);
  }

  private readonly session = inject(UserSessionService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
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
        // Keep any result that has a state AND some district-like admin level.
        // Nominatim's tagging varies by country — for big metros the district
        // often sits in `city` (e.g. Delhi) or `city_district`, not
        // `state_district`, so we fall back through several fields.
        const filtered = results.filter(
          (r) => !!r.address?.state && !!SignupPage.districtOf(r.address),
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

    if (!this.isOldEnough()) {
      this.error.set(`You must be at least ${MIN_AGE} years old to sign up.`);
      return;
    }

    this.loading.set(true);
    try {
      const birthday = `${this.birthYear()}-${String(this.birthMonth()).padStart(2, '0')}-${String(this.birthDay()).padStart(2, '0')}`;

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
        }),
        this.timeoutPromise(),
      ]);

      if (this.destroyed) return;

      if (res.ok) {
        if (res.needsEmailConfirmation) {
          this.awaitingEmailConfirmation.set(true);
        } else {
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

  private timeoutPromise(): Promise<{ ok: false; message: string }> {
    return new Promise((resolve) =>
      setTimeout(() => resolve({ ok: false, message: 'Request timeout (8s)' }), 8000),
    );
  }
}
