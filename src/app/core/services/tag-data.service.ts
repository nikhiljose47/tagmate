import { Injectable, inject } from '@angular/core';
import { Observable, from, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { SupabaseClientService } from './supabase-client.service';
import { AppUser } from '../models/app-user.model';
import { TagRow } from './tag.mapper';

@Injectable({ providedIn: 'root' })
export class TagDataService {
  private readonly clientService = inject(SupabaseClientService);
  private readonly client = this.clientService.client;

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

  deleteRowsWhere(table: string, matchers: Record<string, unknown>) {
    return from(this.client.from(table).delete().match(matchers));
  }

  upsertRow<T extends Record<string, unknown>>(table: string, data: T, onConflict?: string) {
    return from(this.client.from(table).upsert(data, onConflict ? { onConflict } : undefined));
  }

  getRowsIn<T>(table: string, field: string, values: unknown[]): Observable<{ data: T[] | null; error: unknown }> {
    if (!values.length) return of({ data: [], error: null });
    return from(
      this.client.from(table).select('*').in(field, values as (string | number)[])
    ) as Observable<{ data: T[] | null; error: unknown }>;
  }

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

  setUserActive() {
    return from(this.client.rpc('set_user_active'));
  }
}
