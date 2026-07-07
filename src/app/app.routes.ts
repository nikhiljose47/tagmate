import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

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
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: '**', redirectTo: 'login' },
];
