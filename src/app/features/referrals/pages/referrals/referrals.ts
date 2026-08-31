import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ReferralService } from '../../../../core/services/referral.service';
import { RewardService } from '../../../../core/services/reward.service';
import { LoggerService } from '../../../../core/services/logger.service';
import { ToastService } from '../../../../core/services/toast.service';
import {
  Referral,
  ReferralCode,
  ReferralProgramSettings,
  RewardSummary,
} from '../../../../core/models/referral-reward.model';
import { ReferralStatus } from '../../../../core/enums/referral-reward.enum';

@Component({
  selector: 'app-referrals-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink],
  templateUrl: './referrals.html',
  styleUrl: './referrals.scss',
})
export class ReferralsPage implements OnInit {
  private readonly referral = inject(ReferralService);
  private readonly reward = inject(RewardService);
  private readonly logger = inject(LoggerService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly loadError = signal('');
  readonly code = signal<ReferralCode | null>(null);
  readonly settings = signal<ReferralProgramSettings | null>(null);
  readonly summary = signal<RewardSummary | null>(null);
  readonly history = signal<Referral[]>([]);

  readonly referralLink = computed(() => {
    const code = this.code();
    return code ? this.referral.buildReferralLink(code.code) : '';
  });

  /** Only show an active "earn ₹X" CTA while the program is actually on and,
   *  if a campaign window is configured, inside it — never a hard-coded
   *  promise. */
  readonly campaignActive = computed(() => {
    const settings = this.settings();
    if (!settings || !settings.referralEnabled || !settings.rewardEnabled) return false;
    const now = Date.now();
    if (settings.campaignStart && now < new Date(settings.campaignStart).getTime()) return false;
    if (settings.campaignEnd && now > new Date(settings.campaignEnd).getTime()) return false;
    return true;
  });

  readonly formattedRewardAmount = computed(() => {
    const settings = this.settings();
    if (!settings) return '';
    return ReferralsPage.formatRupees(settings.fixedRewardAmount);
  });

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    this.loadError.set('');
    try {
      const [code, settings, summary, history] = await Promise.all([
        this.referral.getReferralCode(),
        this.referral.getProgramSettings(),
        this.reward.getRewardSummary(),
        this.referral.getReferralHistory(),
      ]);
      this.code.set(code);
      this.settings.set(settings);
      this.summary.set(summary);
      this.history.set(history);
    } catch (err) {
      this.logger.error('referrals: failed to load referral dashboard', err);
      this.loadError.set(
        "Couldn't load your referral details right now. Please try again shortly.",
      );
    } finally {
      this.loading.set(false);
    }
  }

  async copyLink(): Promise<void> {
    const link = this.referralLink();
    if (!link) return;
    try {
      await navigator.clipboard?.writeText(link);
      this.toast.show('Referral link copied.', 'success');
    } catch {
      this.toast.show("Couldn't copy the link. Please copy it manually.", 'danger');
    }
  }

  async shareLink(): Promise<void> {
    const link = this.referralLink();
    if (!link) return;
    const text = `Join using my referral link: ${link}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Tagmate', text, url: link });
        return;
      }
      await navigator.clipboard?.writeText(text);
      this.toast.show('Referral link copied.', 'success');
    } catch {
      // A cancelled share sheet isn't an error worth surfacing.
    }
  }

  statusLabel(status: ReferralStatus): string {
    switch (status) {
      case ReferralStatus.Pending:
        return 'Waiting for the qualifying action';
      case ReferralStatus.Qualified:
        return 'Qualified';
      case ReferralStatus.Rewarded:
        return 'Reward earned';
      case ReferralStatus.ReviewRequired:
        return 'Reward verification in progress';
      case ReferralStatus.Rejected:
        return 'Not eligible';
      default:
        return status;
    }
  }

  private static formatRupees(paise: number): string {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(
      paise / 100,
    );
  }
}
