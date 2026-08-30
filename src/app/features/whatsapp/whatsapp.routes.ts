import { Routes } from '@angular/router';

export const WHATSAPP_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/whatsapp-inbox/whatsapp-inbox').then((m) => m.WhatsAppInboxPage),
    title: 'WhatsApp Inbox',
  },
];
