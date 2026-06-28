import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  AuthChangeEvent,
  Session,
  SupabaseClient,
  createClient,
} from '@supabase/supabase-js';
import { BehaviorSubject, Observable, from } from 'rxjs';
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

  signInAnonymously() {
    return from(this.client.auth.signInAnonymously());
  }

  signOut() {
    return from(this.client.auth.signOut());
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
      this.client.from('users').select('*').eq('uid', uid).single<AppUser>()
    ).pipe(map(({ data }) => data));
  }

  updateRow<T>(table: string, id: string, data: Partial<T>) {
    return from(this.client.from(table).update(data as Record<string, unknown>).eq('id', id));
  }

  deleteRow(table: string, id: string) {
    return from(this.client.from(table).delete().eq('id', id));
  }

  upsertRow<T extends Record<string, unknown>>(table: string, data: T) {
    return from(this.client.from(table).upsert(data));
  }

  // ---------- GEOSPATIAL ----------

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

  // ---------- STORAGE ----------

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

  // ---------- UTILITY ----------

  setUserActive() {
    return from(this.client.rpc('set_user_active'));
  }
}
