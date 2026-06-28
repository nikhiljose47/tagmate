import { Routes } from '@angular/router';

export const FEED_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/feed/feed').then((m) => m.FeedPage),
    title: 'Feed',
  },
];
