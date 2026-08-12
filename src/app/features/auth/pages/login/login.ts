import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  signal,
  inject,
  DestroyRef,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { UserSessionService } from '../../../../core/services/user-session.service';
import { ThemeService } from '../../../../core/services/theme.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-login',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrls: ['./login.scss'],
})
export class LoginPage implements OnInit {
  private readonly session = inject(UserSessionService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  public readonly theme = inject(ThemeService);

  email = signal('');
  password = signal('');
  error = signal('');
  loading = signal(false);
  showPassword = signal(false);

  /** True when the last login attempt failed specifically because the email address hasn't been confirmed yet. */
  unconfirmedEmail = signal(false);
  resendingEmail = signal(false);
  resendSent = signal(false);

  private destroyed = false;

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
    });
  }

  ngOnInit(): void {
    // Redirect already-authenticated users away from the login page.
    this.session.user$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((user) => {
      if (this.destroyed) return;
      if (!user.isGuest) this.router.navigateByUrl('/feed-beta');
    });
  }

  async login(): Promise<void> {
    this.error.set('');
    this.unconfirmedEmail.set(false);
    this.resendSent.set(false);
    const em = this.email().trim();
    if (!em) {
      this.error.set('Please enter your email address or username to log in.');
      return;
    }
    this.loading.set(true);

    try {
      const res = await Promise.race([
        this.session.login(this.email(), this.password()),
        this.timeoutPromise(),
      ]);

      if (this.destroyed) return;

      if (res.ok) {
        this.router.navigateByUrl('/feed-beta');
      } else {
        this.error.set(res.message || 'Login failed');
        // Supabase's own error text/code for this case is "Email not confirmed" / 'email_not_confirmed'.
        if (
          ('code' in res && res.code === 'email_not_confirmed') ||
          /email.*not.*confirm/i.test(res.message ?? '')
        ) {
          this.unconfirmedEmail.set(true);
        }
      }
    } finally {
      if (!this.destroyed) {
        this.loading.set(false);
      }
    }
  }

  async resendConfirmationEmail(): Promise<void> {
    if (this.resendingEmail()) return;
    this.resendingEmail.set(true);
    try {
      const ok = await this.session.resendConfirmationEmail(this.email().trim());
      if (ok) this.resendSent.set(true);
    } finally {
      this.resendingEmail.set(false);
    }
  }

  async loginGuest(): Promise<void> {
    this.error.set('');
    this.loading.set(true);

    try {
      const res = await Promise.race([this.session.loginGuest(), this.timeoutPromise()]);

      if (this.destroyed) return;

      if (res && typeof res === 'object' && 'ok' in res && res.ok === false) {
        this.error.set(
          'message' in res && typeof res.message === 'string' ? res.message : 'Guest login failed',
        );
        return;
      }
      this.router.navigateByUrl('/feed-beta');
    } catch (err: unknown) {
      if (!this.destroyed) {
        this.error.set(err instanceof Error ? err.message : 'Guest login failed');
      }
    } finally {
      if (!this.destroyed) {
        this.loading.set(false);
      }
    }
  }

  private timeoutPromise(): Promise<{ ok: false; message: string }> {
    return new Promise((resolve) =>
      setTimeout(() => resolve({ ok: false, message: 'Request timeout (8s)' }), 8000),
    );
  }
}
