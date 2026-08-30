import { CanActivateFn, Router, Routes } from '@angular/router';
import { inject } from '@angular/core';
import { take, map } from 'rxjs';
import { adminGuard, authGuard } from './core/guards/auth.guard';
import { businessPhotosGuard } from './core/guards/business-photos.guard';
import { AuthService } from './core/services/auth.service';

export const rootRedirectGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.session$.pipe(
    take(1),
    map((session) => {
      if (session) {
        return router.createUrlTree(['/feed-beta']);
      } else {
        return router.createUrlTree(['/login']);
      }
    }),
  );
};

export const routes: Routes = [
  {
    path: 'login',
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.AUTH_ROUTES),
  },
  {
    path: 'feed',
    canActivate: [authGuard, businessPhotosGuard],
    loadChildren: () => import('./features/feed/feed.routes').then((m) => m.FEED_ROUTES),
  },
  {
    path: 'feed-beta',
    canActivate: [authGuard, businessPhotosGuard],
    loadChildren: () =>
      import('./features/feed-beta/feed-beta.routes').then((m) => m.FEED_BETA_ROUTES),
  },
  {
    path: 'hood',
    canActivate: [authGuard, businessPhotosGuard],
    loadChildren: () => import('./features/hood/hood.routes').then((m) => m.HOOD_ROUTES),
  },
  // Island is intentionally hidden while the Home feed is being validated.
  // {
  //   path: 'island',
  //   loadChildren: () =>
  //     import('./features/hood-island/hood-island.routes').then((m) => m.HOOD_ISLAND_ROUTES),
  // },
  {
    path: 'post',
    canActivate: [authGuard, businessPhotosGuard],
    loadChildren: () => import('./features/post/post.routes').then((m) => m.POST_ROUTES),
  },
  {
    path: 'posts/:id',
    canActivate: [authGuard, businessPhotosGuard],
    loadComponent: () =>
      import('./features/post/pages/post-detail/post-detail').then((m) => m.PostDetailPage),
  },
  {
    path: 'messages',
    canActivate: [authGuard, businessPhotosGuard],
    loadChildren: () =>
      import('./features/messages/messages.routes').then((m) => m.MESSAGES_ROUTES),
  },
  {
    path: 'reports',
    canActivate: [authGuard, businessPhotosGuard],
    loadChildren: () => import('./features/reports/reports.routes').then((m) => m.REPORTS_ROUTES),
  },
  {
    path: 'analytics',
    canActivate: [authGuard, businessPhotosGuard],
    loadChildren: () =>
      import('./features/analytics/analytics.routes').then((m) => m.ANALYTICS_ROUTES),
  },
  {
    path: 'admin',
    canActivate: [authGuard, adminGuard],
    loadChildren: () => import('./features/admin/admin.routes').then((m) => m.ADMIN_ROUTES),
  },
  {
    path: 'neighborhood/:id',
    canActivate: [authGuard, businessPhotosGuard],
    loadChildren: () =>
      import('./features/neighborhood/neighborhood.routes').then((m) => m.NEIGHBORHOOD_ROUTES),
  },
  {
    path: 'profile',
    canActivate: [authGuard, businessPhotosGuard],
    loadChildren: () => import('./features/profile/profile.routes').then((m) => m.PROFILE_ROUTES),
  },
  {
    path: 'whatsapp',
    canActivate: [authGuard, businessPhotosGuard],
    loadChildren: () =>
      import('./features/whatsapp/whatsapp.routes').then((m) => m.WHATSAPP_ROUTES),
  },
  {
    path: 'users/:uid',
    canActivate: [authGuard, businessPhotosGuard],
    loadComponent: () =>
      import('./features/profile/pages/public-profile/public-profile').then(
        (m) => m.PublicProfilePage,
      ),
    title: 'Neighbor Profile',
  },
  {
    path: 'business-photos',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/onboarding/pages/business-photos/business-photos').then(
        (m) => m.BusinessPhotosPage,
      ),
    title: 'Add your shop photos',
  },
  {
    path: 'not-found',
    loadComponent: () =>
      import('./features/not-found/pages/not-found/not-found').then((m) => m.NotFoundPage),
  },
  {
    path: '',
    pathMatch: 'full',
    canActivate: [rootRedirectGuard],
    children: [],
  },
  { path: '**', redirectTo: 'not-found' },
];
