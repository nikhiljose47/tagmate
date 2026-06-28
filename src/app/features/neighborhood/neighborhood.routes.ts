import { Routes } from '@angular/router';

export const NEIGHBORHOOD_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/neighborhood/neighborhood').then((m) => m.NeighborhoodPage),
    title: 'Neighborhood',
  },
];
