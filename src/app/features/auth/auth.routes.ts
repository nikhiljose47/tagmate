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
  {
    path: 'forgot-password',
    loadComponent: () => import('./pages/forgot-password/forgot-password').then((m) => m.ForgotPasswordComponent),
    title: 'Forgot Password',
  },
  {
    path: 'update-password',
    loadComponent: () => import('./pages/update-password/update-password').then((m) => m.UpdatePasswordComponent),
    title: 'Update Password',
  },
];
