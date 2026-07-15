import { Component, OnInit, signal, inject, DestroyRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { UserSessionService } from '../../../../core/services/user-session.service';
import { ThemeService } from '../../../../core/services/theme.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-login',
  standalone: true,
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
      if (!user.isGuest) this.router.navigateByUrl('/hood');
    });
  }

  async login(): Promise<void> {
    this.error.set('');
    this.loading.set(true);

    try {
      const res: any = await Promise.race([
        this.session.login(this.email(), this.password()),
        this.timeoutPromise(),
      ]);

      if (this.destroyed) return;

      if (res.ok) {
        this.router.navigateByUrl('/hood');
      } else {
        this.error.set(res.message ?? 'Login failed');
      }
    } finally {
      if (!this.destroyed) {
        this.loading.set(false);
      }
    }
  }

  async loginGuest(): Promise<void> {
    this.error.set('');
    this.loading.set(true);

    try {
      const res = await Promise.race([this.session.loginGuest(), this.timeoutPromise()]);

      if (this.destroyed) return;

      if (res && (res as any).ok === false) {
        this.error.set((res as any).message);
        return;
      }
      this.router.navigateByUrl('/hood');
    } catch (err: any) {
      if (!this.destroyed) {
        this.error.set(err?.message ?? 'Guest login failed');
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
