import { Routes } from '@angular/router';

export const REWARDS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/rewards/rewards').then((m) => m.RewardsPage),
    title: 'Rewards',
  },
];
