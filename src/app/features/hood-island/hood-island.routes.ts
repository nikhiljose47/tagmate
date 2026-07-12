import { Routes } from '@angular/router';

export const HOOD_ISLAND_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/hood-island/hood-island').then((m) => m.HoodIslandPage),
  },
];
