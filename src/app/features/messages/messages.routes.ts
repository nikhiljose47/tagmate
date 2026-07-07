import { Routes } from '@angular/router';

export const MESSAGES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/dm-inbox/dm-inbox').then((m) => m.DmInboxComponent),
    title: 'Inbox',
  },
];
