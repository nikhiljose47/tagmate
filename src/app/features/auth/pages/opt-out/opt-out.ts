import { Component, computed, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ThemeService } from '../../../../core/services/theme.service';
import { SupabaseService } from '../../../../core/services/supabase.service';

@Component({
  selector: 'app-opt-out',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="opt-out-container">
      <div class="opt-out-card">
        <div class="icon-header">
          <i class="bi bi-shield-check"></i>
        </div>
        <h1>Email Preferences & Opt-Out</h1>
        <p class="subtitle">Manage non-essential email communications from Tagmate.</p>

        @if (submitted()) {
          <div class="success-message">
            <i class="bi bi-check-circle-fill"></i>
            <span>Your request has been recorded. You have been successfully unsubscribed.</span>
          </div>
          <div class="actions">
            <a routerLink="/login" class="tm-btn tm-btn-primary">Return to Login</a>
          </div>
        } @else {
          @if (error()) {
            <p class="error-message" role="alert">{{ error() }}</p>
          }
          <div class="form-group">
            <label class="field-label">Choose reason for reporting (Optional)</label>
            <select
              class="tm-input"
              [value]="reason()"
              (change)="reason.set($any($event.target).value)"
            >
              <option value="other">Other / Unexpected Email</option>
              <option value="too_many">Too many emails</option>
              <option value="not_signed_up">Did not sign up for this service</option>
              <option value="spam">Spam / Unsolicited</option>
            </select>
          </div>

          <button
            type="button"
            class="tm-btn tm-btn-primary w-full"
            [disabled]="loading() || !hasValidToken()"
            (click)="submitOptOut()"
          >
            @if (loading()) {
              <span>Submitting…</span>
            } @else {
              <span>Report Spam & Unsubscribe</span>
            }
          </button>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .opt-out-container {
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 100vh;
        padding: 1.5rem;
        background: var(--surface-background, #f8fafc);
      }
      .opt-out-card {
        max-width: 480px;
        width: 100%;
        padding: 2rem;
        border-radius: 1rem;
        background: var(--card-bg, #ffffff);
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
        text-align: center;
      }
      .icon-header i {
        font-size: 3rem;
        color: #10b981;
      }
      h1 {
        font-size: 1.5rem;
        font-weight: 700;
        margin-top: 1rem;
      }
      .subtitle {
        font-size: 0.875rem;
        color: #64748b;
        margin-bottom: 1.5rem;
      }
      .form-group {
        text-align: left;
        margin-bottom: 1.5rem;
      }
      .field-label {
        display: block;
        font-size: 0.875rem;
        font-weight: 500;
        margin-bottom: 0.5rem;
      }
      .tm-input {
        width: 100%;
        padding: 0.625rem 0.875rem;
        border-radius: 0.5rem;
        border: 1px solid #cbd5e1;
      }
      .success-message {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 1rem;
        background: #ecfdf5;
        color: #065f46;
        border-radius: 0.5rem;
        margin-bottom: 1.5rem;
      }
      .error-message {
        margin: 0 0 1rem;
        color: #b91c1c;
        font-size: 0.875rem;
      }
    `,
  ],
})
export class OptOutComponent {
  public readonly theme = inject(ThemeService);
  private readonly route = inject(ActivatedRoute);
  private readonly supabase = inject(SupabaseService);
  private readonly token = this.route.snapshot.queryParamMap.get('token')?.trim() ?? '';

  readonly reason = signal('other');
  readonly loading = signal(false);
  readonly submitted = signal(false);
  readonly error = signal(
    this.token
      ? ''
      : 'This email-preference link is missing or invalid. Request a new email from Tagmate.',
  );
  readonly hasValidToken = computed(() =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(this.token),
  );

  async submitOptOut(): Promise<void> {
    if (!this.hasValidToken() || this.loading()) return;
    this.error.set('');
    this.loading.set(true);
    try {
      const { data } = await firstValueFrom(
        this.supabase.callRpc<boolean>('unsubscribe_email', {
          p_token: this.token,
          p_reason: this.reason(),
        }),
      );
      if (!data) {
        this.error.set(
          'This email-preference link is no longer valid. Request a new email from Tagmate.',
        );
        return;
      }
      this.submitted.set(true);
    } catch {
      this.error.set('We could not update your email preference. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }
}
