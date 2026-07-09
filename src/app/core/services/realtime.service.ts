import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable } from 'rxjs';
import { SupabaseClientService } from './supabase-client.service';

@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private readonly clientService = inject(SupabaseClientService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly client = this.clientService.client;

  /** `filter` scopes the subscription to one row/post (e.g. `post_id=eq.<id>`) instead of the whole table. */
  liveInserts<T>(table: string, filter?: string): Observable<T> {
    return new Observable<T>((subscriber) => {
      if (!isPlatformBrowser(this.platformId)) {
        subscriber.complete();
        return undefined;
      }

      const channelName = filter ? `${table}-live-inserts:${filter}` : `${table}-live-inserts`;
      const channel = this.client
        .channel(channelName)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table, ...(filter ? { filter } : {}) },
          (payload) => subscriber.next(payload.new as T)
        )
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR') {
            subscriber.error(new Error(`Realtime channel failed for ${table}`));
          }
        });

      return () => {
        void this.client.removeChannel(channel);
      };
    });
  }
}
