import { ChangeDetectionStrategy, Component, inject, computed } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '../../core/services/auth.service';
import { SocialPlatformService } from '../../core/services/social-platform.service';
import { SocialInteractionsService } from '../../core/services/social-interactions.service';
import { FeatureFlagsService, AppFeatureFlags } from '../../core/services/feature-flags.service';
import { UserSessionService } from '../../core/services/user-session.service';

interface NavItem {
  route: string;
  icon: string;
  activeIcon: string;
  label: string;
  mobile?: boolean;
  adminOnly?: boolean;
  businessOnly?: boolean;
  featureFlag?: keyof AppFeatureFlags;
}

@Component({
  selector: 'app-nav',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './nav.html',
  styleUrls: ['./nav.scss'],
})
export class NavComponent {
  private readonly auth = inject(AuthService);
  private readonly sessionService = inject(UserSessionService);
  protected readonly platform = inject(SocialPlatformService);
  protected readonly social = inject(SocialInteractionsService);
  protected readonly featureFlags = inject(FeatureFlagsService);

  private readonly session = toSignal(this.auth.session$, { initialValue: null });
  readonly isAdmin = computed(() => this.session()?.user?.app_metadata?.['role'] === 'admin');
  readonly isBusinessAccount = computed(
    () => this.sessionService.user()?.accountType === 'business',
  );

  readonly navItems: NavItem[] = [
    {
      route: '/feed-beta',
      icon: 'bi-house',
      activeIcon: 'bi-house-fill',
      label: 'Home',
      mobile: true,
    },
    // Island is intentionally hidden for now.
    {
      route: '/post',
      icon: 'bi-plus-square',
      activeIcon: 'bi-plus-square-fill',
      label: 'Post',
      mobile: true,
    },
    {
      route: '/messages',
      icon: 'bi-chat-left-dots',
      activeIcon: 'bi-chat-left-dots-fill',
      label: 'Messages',
      mobile: true,
    },
    {
      route: '/whatsapp',
      icon: 'bi-whatsapp',
      activeIcon: 'bi-whatsapp',
      label: 'WhatsApp',
      businessOnly: true,
    },
    {
      route: '/analytics',
      icon: 'bi-bar-chart',
      activeIcon: 'bi-bar-chart-fill',
      label: 'Analytics',
      featureFlag: 'enableAnalytics',
    },
    {
      route: '/admin',
      icon: 'bi-shield-check',
      activeIcon: 'bi-shield-fill-check',
      label: 'Admin',
      adminOnly: true,
    },
  ];

  readonly visibleNavItems = computed(() =>
    this.navItems.filter((item) => {
      if (item.adminOnly && !this.isAdmin()) return false;
      if (item.businessOnly && !this.isBusinessAccount()) return false;
      if (item.featureFlag === 'enableHoodIsland' && !this.featureFlags.enableHoodIsland())
        return false;
      if (item.featureFlag === 'enableAnalytics' && !this.featureFlags.enableAnalytics())
        return false;
      return true;
    }),
  );

  openNotifications(): void {
    this.social.notificationsOpen.set(true);
  }
}
