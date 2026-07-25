import { Routes } from '@angular/router';

export const FEED_BETA_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/feed-beta/feed-beta').then((m) => m.FeedBetaPage),
    title: 'Feed Beta',
  },
];
