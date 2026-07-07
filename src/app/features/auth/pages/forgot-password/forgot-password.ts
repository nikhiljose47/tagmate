import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { UserSessionService } from '../../../../core/services/user-session.service';
import { ThemeService } from '../../../../core/services/theme.service';
import { ToastService } from '../../../../core/services/toast.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './forgot-password.html',
  styleUrls: ['./forgot-password.scss'],
})
export class ForgotPasswordComponent {
  private readonly session = inject(UserSessionService);
  private readonly toast = inject(ToastService);
  public readonly theme = inject(ThemeService);

  email = signal('');
  error = signal('');
  success = signal(false);
  loading = signal(false);

  async onSubmit(): Promise<void> {
    const emailVal = this.email().trim();
    if (!emailVal) {
      this.error.set('Please enter your email.');
      return;
    }

    this.error.set('');
    this.loading.set(true);
    try {
      const { error } = await this.session.resetPassword(emailVal) as any;
      if (error) {
        this.error.set(error.message || 'Reset failed');
      } else {
        this.success.set(true);
        this.toast.show('Password reset link sent!', 'success');
      }
    } catch (err: any) {
      this.error.set(err?.message ?? 'Something went wrong');
    } finally {
      this.loading.set(false);
    }
  }
}
