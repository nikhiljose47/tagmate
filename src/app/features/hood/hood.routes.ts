import { Routes } from '@angular/router';

export const HOOD_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/hood/hood').then((m) => m.HoodPage),
    title: 'Hood Map',
  },
];
