import { Routes } from '@angular/router';

export const POST_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/post/post').then((m) => m.PostPage),
    title: 'Post',
  },
];
