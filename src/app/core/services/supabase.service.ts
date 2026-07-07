import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  AuthChangeEvent,
  Session,
  SupabaseClient,
  createClient,
} from '@supabase/supabase-js';
import { BehaviorSubject, Observable, from, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment.prod';
import { AppUser } from '../models/app-user.model';
import { TagRow } from './tag.mapper';

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  private readonly platformId = inject(PLATFORM_ID);

  private readonly client: SupabaseClient = createClient(
    environment.supabaseUrl,
    environment.supabaseAnonKey,
    {
      auth: {
        storage: isPlatformBrowser(this.platformId)
          ? globalThis.localStorage
          : {
              getItem: (_key: string) => null,
              setItem: (_key: string, _value: string) => {},
              removeItem: (_key: string) => {},
            },
        autoRefreshToken: isPlatformBrowser(this.platformId),
        persistSession: isPlatformBrowser(this.platformId),
        detectSessionInUrl: isPlatformBrowser(this.platformId),
      },
    }
  );

  private readonly _session$ = new BehaviorSubject<Session | null>(null);
  readonly session$: Observable<Session | null> = this._session$.asObservable();

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.client.auth.getSession().then(({ data }) => this._session$.next(data.session));
    }

    this.client.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        this._session$.next(session);
      }
    );
  }

  // ---------- AUTH ----------

  signInWithPassword(email: string, password: string) {
    return from(this.client.auth.signInWithPassword({ email, password }));
  }

  signUp(email: string, password: string, metadata: Record<string, unknown>) {
    return from(this.client.auth.signUp({ email, password, options: { data: metadata } }));
  }

  /** Best-effort check — final say is the DB write, since this can race with a concurrent signup. */
  isUsernameTaken(username: string): Observable<boolean> {
    return from(
      this.client.from('users').select('uid').ilike('name', username).limit(1)
    ).pipe(map(({ data }) => !!data && data.length > 0));
  }

  signInAnonymously() {
    return from(this.client.auth.signInAnonymously());
  }

  signOut() {
    return from(this.client.auth.signOut());
  }

  resetPassword(email: string) {
    const redirectUrl = typeof window !== 'undefined' ? `${window.location.origin}/login/update-password` : '';
    return from(this.client.auth.resetPasswordForEmail(email, { redirectTo: redirectUrl }));
  }

  updatePassword(password: string) {
    return from(this.client.auth.updateUser({ password }));
  }

  updateUserMetadata(metadata: Record<string, unknown>) {
    return from(this.client.auth.updateUser({ data: metadata }));
  }


  // ---------- DATA ----------

  addRow<T extends Record<string, unknown>>(table: string, data: T) {
    return from(this.client.from(table).insert(data).select().single<T>());
  }

  getRows<T>(
    table: string,
    condition?: { field: string; op: '=='; value: unknown }
  ): Observable<{ data: T[] | null; error: unknown }> {
    let query = this.client.from(table).select('*');
    if (condition) {
      query = query.eq(condition.field, condition.value as string);
    }
    return from(query) as Observable<{ data: T[] | null; error: unknown }>;
  }

  getRow<T>(table: string, id: string): Observable<{ data: T | null; error: unknown }> {
    return from(
      this.client.from(table).select('*').eq('id', id).single<T>()
    ) as Observable<{ data: T | null; error: unknown }>;
  }

  getUserById(uid: string): Observable<AppUser | null> {
    return from(
      this.client.from('users').select('*').eq('uid', uid).single<any>()
    ).pipe(
      map(({ data }) => {
        if (!data) return null;
        return {
          uid: data.uid,
          name: data.name,
          isGuest: !!data.is_guest,
          email: data.email ?? undefined,
          reputation: data.reputation ?? 0,
        };
      })
    );
  }

  updateRow<T>(table: string, id: string, data: Partial<T>) {
    return from(this.client.from(table).update(data as Record<string, unknown>).eq('id', id).select().single<T>());
  }

  deleteRow(table: string, id: string) {
    return from(this.client.from(table).delete().eq('id', id));
  }

  /** Composite-key delete — for tables with no single-column `id` the caller wants to target. */
  deleteRowsWhere(table: string, matchers: Record<string, unknown>) {
    return from(this.client.from(table).delete().match(matchers));
  }

  upsertRow<T extends Record<string, unknown>>(table: string, data: T, onConflict?: string) {
    return from(this.client.from(table).upsert(data, onConflict ? { onConflict } : undefined));
  }

  /** Fetch rows where `field` is one of `values` (Postgres IN). Skips the network call for an empty array. */
  getRowsIn<T>(table: string, field: string, values: unknown[]): Observable<{ data: T[] | null; error: unknown }> {
    if (!values.length) return of({ data: [], error: null });
    return from(
      this.client.from(table).select('*').in(field, values as (string | number)[])
    ) as Observable<{ data: T[] | null; error: unknown }>;
  }

  // ---------- GEOSPATIAL ----------

  /** Fetch the most-recent `limit` rows from a table, ordered by created_at desc. */
  getLatest<T>(table: string, limit: number): Observable<{ data: T[] | null; error: unknown }> {
    return from(
      this.client.from(table).select('*').order('created_at', { ascending: false }).limit(limit)
    ) as Observable<{ data: T[] | null; error: unknown }>;
  }

  getLatestPaginated<T>(table: string, limit: number, offset: number, search?: string): Observable<{ data: T[] | null; error: unknown }> {
    let query = this.client.from(table).select('*').order('created_at', { ascending: false }).range(offset, offset + limit - 1);
    
    if (search) {
      const searchTerm = `%${search}%`;
      query = query.or(`highlight.ilike.${searchTerm},username.ilike.${searchTerm},tag.ilike.${searchTerm},hood_id.ilike.${searchTerm}`);
    }

    return from(query) as Observable<{ data: T[] | null; error: unknown }>;
  }

  getFilteredRows<T>(
    table: string,
    filters: {
      tags?: string[];
      before?: string;
      after?: string;
      userId?: string;
      search?: string;
      excludeTag?: string;
      hoodId?: string;
    },
    limit?: number,
    offset?: number
  ): Observable<{ data: T[] | null; error: unknown }> {
    let query = this.client.from(table).select('*');
    
    if (filters.userId) {
      query = query.eq('user_id', filters.userId);
    }
    if (filters.hoodId) {
      query = query.eq('hood_id', filters.hoodId);
    }
    if (filters.tags && filters.tags.length > 0) {
      query = query.in('tag', filters.tags);
    }
    if (filters.excludeTag) {
      query = query.neq('tag', filters.excludeTag);
    }
    if (filters.before) {
      query = query.lte('created_at', filters.before);
    }
    if (filters.after) {
      query = query.gte('created_at', filters.after);
    }
    if (filters.search) {
      // Strip special characters like commas and parentheses to prevent PostgREST parsing syntax hijacking
      const sanitized = filters.search.replace(/[,()]/g, '');
      const term = `%${sanitized}%`;
      query = query.or(`highlight.ilike.${term},username.ilike.${term},tag.ilike.${term}`);
    }
    
    query = query.order('created_at', { ascending: false });
    
    if (limit !== undefined && offset !== undefined) {
      query = query.range(offset, offset + limit - 1);
    } else if (limit !== undefined) {
      query = query.limit(limit);
    }
    
    return from(query) as Observable<{ data: T[] | null; error: unknown }>;
  }

  fetchTagsInBounds(
    minLng: number,
    minLat: number,
    maxLng: number,
    maxLat: number
  ): Observable<{ data: TagRow[] | null; error: unknown }> {
    return from(
      this.client.rpc('fetch_tags_in_bounds', {
        min_lng: minLng,
        min_lat: minLat,
        max_lng: maxLng,
        max_lat: maxLat,
      })
    ) as Observable<{ data: TagRow[] | null; error: unknown }>;
  }

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

  // ---------- STORAGE ----------

  /** Upload a raw File (image or video) directly to the tag-images bucket. */
  async uploadFile(path: string, file: File): Promise<string> {
    const { error } = await this.client.storage
      .from('tag-images')
      .upload(path, file, { contentType: file.type, upsert: false });

    if (error) throw error;

    const { data } = this.client.storage.from('tag-images').getPublicUrl(path);
    return data.publicUrl;
  }

  async uploadImageBase64(path: string, base64Data: string): Promise<string> {
    const [header, raw] = base64Data.split(',');
    const mimeMatch = header.match(/data:([^;]+);base64/);
    const contentType = mimeMatch?.[1] ?? 'image/jpeg';

    const binary = atob(raw);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    const { error } = await this.client.storage
      .from('tag-images')
      .upload(path, bytes, { contentType, upsert: false });

    if (error) throw error;

    const { data } = this.client.storage.from('tag-images').getPublicUrl(path);
    return data.publicUrl;
  }

  // ---------- SOCIAL ----------

  getDirectMessagesForUser(uid: string): Observable<{ data: any[] | null; error: unknown }> {
    return from(
      this.client
        .from('direct_messages')
        .select('*')
        .or(`from_uid.eq.${uid},to_uid.eq.${uid}`)
        .order('created_at', { ascending: false })
    ) as Observable<{ data: any[] | null; error: unknown }>;
  }

  incrementCommentUpvote(commentId: string) {
    return from(this.client.rpc('increment_comment_upvote', { p_comment_id: commentId }));
  }

  // ---------- UTILITY ----------

  setUserActive() {
    return from(this.client.rpc('set_user_active'));
  }
}
