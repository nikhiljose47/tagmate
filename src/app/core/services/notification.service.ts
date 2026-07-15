import { Injectable, inject } from '@angular/core';
import { NotificationRow } from './social.mapper';
import { SupabaseService } from './supabase.service';

/** Database operations for durable notification creation and read state. */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly supabase = inject(SupabaseService);

  create(notification: Omit<NotificationRow, 'id'>) {
    return this.supabase.addRow('notifications', { ...notification });
  }

  markRead(notificationId: string, readAt: string) {
    return this.supabase.updateRow('notifications', notificationId, {
      read: true,
      read_at: readAt,
    });
  }

  markAllRead(uid: string, readAt: string) {
    return this.supabase.updateRowsWhere(
      'notifications',
      { user_id: uid },
      { read: true, read_at: readAt },
    );
  }
}
