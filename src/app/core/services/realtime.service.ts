import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable } from 'rxjs';
import { SupabaseClientService } from './supabase-client.service';

@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private readonly clientService = inject(SupabaseClientService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly client = this.clientService.client;
  private channelSequence = 0;

  /** `filter` scopes the subscription to one row/post (e.g. `post_id=eq.<id>`) instead of the whole table. */
  liveInserts<T>(table: string, filter?: string): Observable<T> {
    return this.liveChanges<T>(table, 'INSERT', filter);
  }

  liveUpdates<T>(table: string, filter?: string): Observable<T> {
    return this.liveChanges<T>(table, 'UPDATE', filter);
  }

  liveDeletes<T>(table: string, filter?: string): Observable<T> {
    return this.liveChanges<T>(table, 'DELETE', filter);
  }

  private liveChanges<T>(table: string, event: 'INSERT' | 'UPDATE' | 'DELETE', filter?: string): Observable<T> {
    return new Observable<T>((subscriber) => {
      if (!isPlatformBrowser(this.platformId)) {
        subscriber.complete();
        return undefined;
      }

      // Supabase channels cannot add postgres callbacks after subscribe(). Each
      // observable therefore gets its own channel, even when two consumers
      // watch the same table/event (for example inbox state and message cache).
      const baseName = filter ? `${table}-${event.toLowerCase()}:${filter}` : `${table}-${event.toLowerCase()}`;
      const channelName = `${baseName}:${++this.channelSequence}`;
      const channel = this.client
        .channel(channelName)
        .on(
          'postgres_changes',
          { event, schema: 'public', table, ...(filter ? { filter } : {}) },
          (payload) => subscriber.next((event === 'DELETE' ? payload.old : payload.new) as T)
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
