import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { UserSessionService } from '../../../../core/services/user-session.service';
import { ThemeService } from '../../../../core/services/theme.service';
import { ToastService } from '../../../../core/services/toast.service';

@Component({
  selector: 'app-update-password',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './update-password.html',
  styleUrls: ['./update-password.scss'],
})
export class UpdatePasswordComponent {
  private readonly session = inject(UserSessionService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  public readonly theme = inject(ThemeService);

  password = signal('');
  error = signal('');
  loading = signal(false);

  async onSubmit(): Promise<void> {
    const pass = this.password().trim();
    if (pass.length < 6) {
      this.error.set('Password must be at least 6 characters long.');
      return;
    }

    this.error.set('');
    this.loading.set(true);
    try {
      const { error } = await this.session.updatePassword(pass) as any;
      if (error) {
        this.error.set(error.message || 'Update failed');
      } else {
        this.toast.show('Password updated successfully!', 'success');
        void this.router.navigate(['/tagmate']);
      }
    } catch (err: any) {
      this.error.set(err?.message ?? 'Something went wrong');
    } finally {
      this.loading.set(false);
    }
  }
}
