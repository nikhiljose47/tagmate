import { Routes } from '@angular/router';

export const AUTH_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/login/login').then((m) => m.LoginPage),
    title: 'Login',
  },
  {
    path: 'signup',
    loadComponent: () => import('./pages/signup/signup').then((m) => m.SignupPage),
    title: 'Sign Up',
  },
];
