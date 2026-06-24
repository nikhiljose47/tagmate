import { Routes } from '@angular/router';
import { Tagmate } from './components/tagmate/tagmate';
import { Login } from './components/login/login';
import { Tagmate2 } from './components/tagmate2/tagmate2';
import { TagForm } from './components/tag-form/tag-form';
import { TagExplorer } from './components/tag-explorer/tag-explorer';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: 'login', component: Login, title: 'Login' },
  {
    path: 'tagmate',
    title: 'Globe',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/tag-explorer/tag-explorer').then((m) => m.TagExplorer),
  },
  {
    path: 'hood',
    title: 'Hood Map',
    canActivate: [authGuard],
    loadComponent: () => import('./components/tagmate/tagmate').then((m) => m.Tagmate),
  },
  {
    path: 'post',
    title: 'Post',
    canActivate: [authGuard],
    loadComponent: () => import('./components/tag-form/tag-form').then((m) => m.TagForm),
  },
  {
    path: 'profile',
    title: 'Profile',
    canActivate: [authGuard],
    loadComponent: () => import('./components/profile/profile').then((m) => m.Profile),
  },
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: '**', redirectTo: 'login' },
];
