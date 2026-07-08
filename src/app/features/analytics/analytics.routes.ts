import { Routes } from '@angular/router';

export const ANALYTICS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/analytics/analytics').then((m) => m.AnalyticsPage),
    title: 'Analytics',
  },
];
