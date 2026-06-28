import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  // Public routes
  {
    path: 'login',
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.AUTH_ROUTES),
  },

  // Protected routes — each feature loads its own chunk
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
    path: 'profile',
    canActivate: [authGuard],
    loadChildren: () => import('./features/profile/profile.routes').then((m) => m.PROFILE_ROUTES),
  },

  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: '**', redirectTo: 'login' },
];
