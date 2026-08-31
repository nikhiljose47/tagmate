import { Routes } from '@angular/router';

export const REFERRALS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/referrals/referrals').then((m) => m.ReferralsPage),
    title: 'Refer & Earn',
  },
];
