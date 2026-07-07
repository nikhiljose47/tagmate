import { Routes } from '@angular/router';

export const POST_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/post/post').then((m) => m.PostPage),
    title: 'Post',
  },
  {
    path: 'edit/:id',
    loadComponent: () => import('./pages/post-edit/post-edit').then((m) => m.PostEditComponent),
    title: 'Edit Post',
  },
];
