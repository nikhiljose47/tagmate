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

  private liveChanges<T>(
    table: string,
    event: 'INSERT' | 'UPDATE' | 'DELETE',
    filter?: string,
  ): Observable<T> {
    return new Observable<T>((subscriber) => {
      if (!isPlatformBrowser(this.platformId)) {
        subscriber.complete();
        return undefined;
      }

      let activeChannel: ReturnType<typeof this.client.channel> | null = null;
      let retryTimer: ReturnType<typeof setTimeout> | null = null;
      let retryCount = 0;
      let stopped = false;

      const subscribeChannel = () => {
        if (stopped) return;
        const baseName = filter
          ? `${table}-${event.toLowerCase()}:${filter}`
          : `${table}-${event.toLowerCase()}`;
        const channelName = `${baseName}:${++this.channelSequence}`;

        const channel = this.client
          .channel(channelName)
          .on(
            'postgres_changes',
            { event, schema: 'public', table, ...(filter ? { filter } : {}) },
            (payload) => {
              if (!stopped && activeChannel === channel) {
                subscriber.next((event === 'DELETE' ? payload.old : payload.new) as T);
              }
            },
          );
        activeChannel = channel;
        channel.subscribe((status) => {
          if (stopped || activeChannel !== channel) return;
          if (status === 'SUBSCRIBED') {
            retryCount = 0;
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            activeChannel = null;
            void this.client.removeChannel(channel);
            retryCount = Math.min(retryCount + 1, 6);
            const delayMs = Math.min(1000 * Math.pow(2, retryCount - 1), 30000);
            retryTimer = setTimeout(() => {
              retryTimer = null;
              subscribeChannel();
            }, delayMs);
          }
        });
      };

      subscribeChannel();

      return () => {
        stopped = true;
        if (retryTimer) clearTimeout(retryTimer);
        if (activeChannel) {
          void this.client.removeChannel(activeChannel);
          activeChannel = null;
        }
      };
    });
  }
}
