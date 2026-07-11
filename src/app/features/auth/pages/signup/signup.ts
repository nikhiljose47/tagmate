import { Component, OnInit, signal, computed, inject, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { UserSessionService } from '../../../../core/services/user-session.service';
import { ThemeService } from '../../../../core/services/theme.service';

const MIN_AGE = 13;
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './signup.html',
  styleUrls: ['./signup.scss'],
})
export class SignupPage implements OnInit {
  email    = signal('');
  password = signal('');
  fullName = signal('');
  username = signal('');

  birthMonth = signal('');
  birthDay   = signal('');
  birthYear  = signal('');

  error    = signal('');
  loading  = signal(false);
  showPassword = signal(false);

  usernameChecking = signal(false);
  usernameTaken    = signal(false);
  private usernameCheckTimer: ReturnType<typeof setTimeout> | undefined;

  readonly months = MONTHS;
  readonly days = Array.from({ length: 31 }, (_, i) => i + 1);
  readonly years = (() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 100 }, (_, i) => currentYear - i);
  })();

  isPasswordStrong(pw: string): boolean {
    return pw.length >= 8 && /[A-Z]/.test(pw) && /[a-z]/.test(pw) && /[0-9]/.test(pw);
  }

  readonly canSubmit = computed(() => {
    return (
      !!this.email() &&
      this.isPasswordStrong(this.password()) &&
      !!this.fullName().trim() &&
      this.username().trim().length >= 3 &&
      !!this.birthMonth() &&
      !!this.birthDay() &&
      !!this.birthYear() &&
      !this.usernameTaken() &&
      !this.loading()
    );
  });

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
    this.session.user$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((user) => {
        if (this.destroyed) return;
        if (!user.isGuest) this.router.navigateByUrl('/feed');
      });
  }

  onUsernameInput(value: string): void {
    this.username.set(value);
    this.usernameTaken.set(false);

    clearTimeout(this.usernameCheckTimer);
    const candidate = value.trim();
    if (candidate.length < 3) return;

    this.usernameCheckTimer = setTimeout(async () => {
      this.usernameChecking.set(true);
      try {
        const taken = await this.session.isUsernameTaken(candidate);
        if (this.username().trim() === candidate) this.usernameTaken.set(taken);
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

  async signup(): Promise<void> {
    this.error.set('');

    if (!this.isOldEnough()) {
      this.error.set(`You must be at least ${MIN_AGE} years old to sign up.`);
      return;
    }

    this.loading.set(true);
    try {
      const taken = await this.session.isUsernameTaken(this.username().trim());
      if (taken) {
        this.usernameTaken.set(true);
        this.error.set('That username is already taken.');
        return;
      }

      const birthday = `${this.birthYear()}-${String(this.birthMonth()).padStart(2, '0')}-${String(this.birthDay()).padStart(2, '0')}`;

      const res = await Promise.race([
        this.session.signup(this.email(), this.password(), {
          username: this.username().trim(),
          fullName: this.fullName().trim(),
          birthday,
        }),
        this.timeoutPromise(),
      ]);

      if (this.destroyed) return;

      if (res.ok) {
        this.router.navigateByUrl('/feed');
      } else {
        this.error.set(res.message ?? 'Signup failed');
      }
    } finally {
      if (!this.destroyed) {
        this.loading.set(false);
      }
    }
  }

  private timeoutPromise(): Promise<{ ok: false; message: string }> {
    return new Promise((resolve) =>
      setTimeout(() => resolve({ ok: false, message: 'Request timeout (8s)' }), 8000)
    );
  }
}
