import { CanActivateFn, Router, Routes } from '@angular/router';
import { inject } from '@angular/core';
import { take, map } from 'rxjs';
import { authGuard } from './core/guards/auth.guard';
import { AuthService } from './core/services/auth.service';

export const rootRedirectGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.session$.pipe(
    take(1),
    map((session) => {
      if (session) {
        return router.createUrlTree(['/feed']);
      } else {
        return router.createUrlTree(['/login']);
      }
    })
  );
};

export const routes: Routes = [
  {
    path: 'login',
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.AUTH_ROUTES),
  },
  {
    path: 'feed',
    canActivate: [authGuard],
    loadChildren: () => import('./features/feed/feed.routes').then((m) => m.FEED_ROUTES),
  },
  {
    path: 'hood',
    canActivate: [authGuard],
    loadChildren: () => import('./features/hood/hood.routes').then((m) => m.HOOD_ROUTES),
  },
  {
    path: 'tagmate',
    canActivate: [authGuard],
    loadChildren: () => import('./features/globe/globe.routes').then((m) => m.GLOBE_ROUTES),
  },
  {
    path: 'post',
    canActivate: [authGuard],
    loadChildren: () => import('./features/post/post.routes').then((m) => m.POST_ROUTES),
  },
  {
    path: 'posts/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/post/pages/post-detail/post-detail').then((m) => m.PostDetailPage),
  },
  {
    path: 'messages',
    canActivate: [authGuard],
    loadChildren: () => import('./features/messages/messages.routes').then((m) => m.MESSAGES_ROUTES),
  },
  {
    path: 'reports',
    canActivate: [authGuard],
    loadChildren: () => import('./features/reports/reports.routes').then((m) => m.REPORTS_ROUTES),
  },
  {
    path: 'analytics',
    canActivate: [authGuard],
    loadChildren: () => import('./features/analytics/analytics.routes').then((m) => m.ANALYTICS_ROUTES),
  },
  {
    path: 'admin',
    canActivate: [authGuard],
    loadChildren: () => import('./features/admin/admin.routes').then((m) => m.ADMIN_ROUTES),
  },
  {
    path: 'neighborhood/:id',
    canActivate: [authGuard],
    loadChildren: () =>
      import('./features/neighborhood/neighborhood.routes').then((m) => m.NEIGHBORHOOD_ROUTES),
  },
  {
    path: 'profile',
    canActivate: [authGuard],
    loadChildren: () => import('./features/profile/profile.routes').then((m) => m.PROFILE_ROUTES),
  },
  {
    path: 'not-found',
    loadComponent: () => import('./features/not-found/pages/not-found/not-found').then((m) => m.NotFoundPage),
  },
  {
    path: '',
    pathMatch: 'full',
    canActivate: [rootRedirectGuard],
    children: [],
  },
  { path: '**', redirectTo: 'not-found' },
];
