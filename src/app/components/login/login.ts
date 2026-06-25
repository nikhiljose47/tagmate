import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { CommonModule } from '@angular/common';
import { UserSessionService } from '../../services/user-session.service';

@Component({
  selector: 'login',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './login.html',
  styleUrls: ['./login.scss'],
})
export class Login implements OnInit {
  email = signal('');
  password = signal('');
  error = signal('');
  loading = signal(false);

  constructor(
    private auth: AuthService,
    private session: UserSessionService,
    private router: Router
  ) {}

  ngOnInit() {
    this.auth.user$.subscribe((user) => {
      if (!user.isGuest) {
        this.router.navigateByUrl('/tagmate');
      }
    });
  }

  private timeoutPromise() {
    return new Promise((resolve) =>
      setTimeout(
        () => resolve({ ok: false, message: 'Request timeout (8s)' }),
        8000
      )
    );
  }

  async login() {
    this.error.set('');
    this.loading.set(true);

    try {
      const res: any = await Promise.race([
        this.auth.login(this.email(), this.password()),
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

  async loginGuest() {
    this.error.set('');
    this.loading.set(true);

    try {
      const res: any = await Promise.race([
        this.session.loginGuest(),
        this.timeoutPromise(),
      ]);

      if (res.ok === false) {
        this.error.set(res.message ?? 'Guest login failed');
        return;
      }

      this.router.navigateByUrl('/tagmate');
    } finally {
      this.loading.set(false);
    }
  }
}
