import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
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
  email    = signal('');
  password = signal('');
  error    = signal('');
  loading  = signal(false);
  showPassword = signal(false);

  constructor(
    private session: UserSessionService,
    private router:  Router,
    public theme:    ThemeService
  ) {}

  ngOnInit(): void {
    // Redirect already-authenticated users away from the login page.
    this.session.user$.subscribe((user) => {
      if (!user.isGuest) this.router.navigateByUrl('/tagmate');
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

      if (res.ok) {
        this.router.navigateByUrl('/tagmate');
      } else {
        this.error.set(res.message ?? 'Login failed');
      }
    } finally {
      this.loading.set(false);
    }
  }

  async loginGuest(): Promise<void> {
    this.error.set('');
    this.loading.set(true);

    try {
      await Promise.race([this.session.loginGuest(), this.timeoutPromise()]);
      this.router.navigateByUrl('/tagmate');
    } catch (err: any) {
      this.error.set(err?.message ?? 'Guest login failed');
    } finally {
      this.loading.set(false);
    }
  }

  private timeoutPromise(): Promise<{ ok: false; message: string }> {
    return new Promise((resolve) =>
      setTimeout(() => resolve({ ok: false, message: 'Request timeout (8s)' }), 8000)
    );
  }
}
