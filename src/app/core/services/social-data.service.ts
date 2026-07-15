import { Injectable, inject } from '@angular/core';
import { Observable, from, of } from 'rxjs';
import { SupabaseClientService } from './supabase-client.service';
import { DirectMessageRow } from './social.mapper';

@Injectable({ providedIn: 'root' })
export class SocialDataService {
  private readonly clientService = inject(SupabaseClientService);
  private readonly client = this.clientService.client;

  getDirectMessagesForUser(
    uid: string,
  ): Observable<{ data: DirectMessageRow[] | null; error: unknown }> {
    const uuidRegex =
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    if (!uuidRegex.test(uid)) {
      return of({ data: [], error: null });
    }
    return from(
      this.client
        .from('direct_messages')
        .select('*')
        .or(`from_uid.eq.${uid},to_uid.eq.${uid}`)
        .order('created_at', { ascending: false }),
    ) as Observable<{ data: DirectMessageRow[] | null; error: unknown }>;
  }
}
