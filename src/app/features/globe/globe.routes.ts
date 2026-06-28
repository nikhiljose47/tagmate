import { Routes } from '@angular/router';

export const GLOBE_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/globe/globe').then((m) => m.GlobePage),
    title: 'Globe',
  },
];
