import { Injectable, inject } from '@angular/core';
import { Observable, from, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { SupabaseClientService } from './supabase-client.service';
import { AppUser } from '../models/app-user.model';
import { Hood } from '../models/hood.model';
import { TagRow } from './tag.mapper';
import { UserRow } from './social.mapper';

@Injectable({ providedIn: 'root' })
export class TagDataService {
  private readonly clientService = inject(SupabaseClientService);
  private readonly client = this.clientService.client;

  private requireSuccess<T extends { error: unknown }>(result: T): T {
    if (result.error) throw result.error;
    return result;
  }

  addRow<T>(table: string, data: Record<string, unknown>) {
    return from(this.client.from(table).insert(data).select().single<T>()).pipe(
      map((result) => this.requireSuccess(result)),
    );
  }

  getRows<T>(
    table: string,
    condition?: { field: string; op: '=='; value: unknown },
  ): Observable<{ data: T[] | null; error: unknown }> {
    let query = this.client.from(table).select('*');
    if (condition) {
      query = query.eq(condition.field, condition.value as string);
    }
    return from(query).pipe(map((result) => this.requireSuccess(result))) as Observable<{
      data: T[] | null;
      error: unknown;
    }>;
  }

  getRow<T>(table: string, id: string): Observable<{ data: T | null; error: unknown }> {
    return from(this.client.from(table).select('*').eq('id', id).single<T>()).pipe(
      map((result) => this.requireSuccess(result)),
    ) as Observable<{ data: T | null; error: unknown }>;
  }

  getUserById(uid: string): Observable<AppUser | null> {
    return from(
      this.client
        .from('public_user_profiles')
        .select(
          'uid,name,is_guest,reputation,created_at,account_type,business_name,business_website,business_category,business_images',
        )
        .eq('uid', uid)
        .maybeSingle<UserRow>(),
    ).pipe(
      map((result) => {
        const { data } = this.requireSuccess(result);
        return data ? this.mapUser(data) : null;
      }),
    );
  }

  getCurrentUserById(uid: string): Observable<AppUser | null> {
    return from(
      this.client
        .from('my_user_profile')
        .select(
          'uid,name,email,is_guest,reputation,created_at,' +
            'home_state,home_country,home_district,home_place,home_lat,home_lng,home_updated_at,' +
            'account_type,business_name,business_phone,business_website,business_category,business_images',
        )
        .eq('uid', uid)
        .maybeSingle<UserRow>(),
    ).pipe(
      map((result) => {
        const { data } = this.requireSuccess(result);
        return data ? this.mapUser(data) : null;
      }),
    );
  }

  private mapUser(data: UserRow): AppUser {
    const hood = data.home_state
      ? new Hood({
          name: data.home_place || data.home_district || data.home_state,
          state: data.home_state,
          country: data.home_country || 'India',
          district: data.home_district || '',
          place: data.home_place || '',
          coords: {
            lat: data.home_lat ?? 0,
            lng: data.home_lng ?? 0,
          },
          updatedAt: data.home_updated_at || '',
        })
      : undefined;
    return {
      uid: data.uid,
      name: data.name,
      isGuest: !!data.is_guest,
      email: data.email ?? undefined,
      reputation: data.reputation ?? 0,
      createdAt: data.created_at ?? undefined,
      hood,
      accountType: data.account_type === 'business' ? 'business' : 'personal',
      businessName: data.business_name ?? undefined,
      businessPhone: data.business_phone ?? undefined,
      businessWebsite: data.business_website ?? undefined,
      businessCategory: data.business_category ?? undefined,
      businessImages: data.business_images ?? undefined,
    };
  }

  updateRow<T>(table: string, id: string, data: Partial<T>) {
    return from(
      this.client
        .from(table)
        .update(data as Record<string, unknown>)
        .eq('id', id)
        .select()
        .single<T>(),
    ).pipe(map((result) => this.requireSuccess(result)));
  }

  deleteRow(table: string, id: string) {
    return from(this.client.from(table).delete().eq('id', id)).pipe(
      map((result) => this.requireSuccess(result)),
    );
  }

  deleteRowsWhere(table: string, matchers: Record<string, unknown>) {
    return from(this.client.from(table).delete().match(matchers)).pipe(
      map((result) => this.requireSuccess(result)),
    );
  }

  updateRowsWhere<T>(table: string, matchers: Record<string, unknown>, data: Partial<T>) {
    return from(
      this.client
        .from(table)
        .update(data as Record<string, unknown>)
        .match(matchers),
    ).pipe(map((result) => this.requireSuccess(result)));
  }

  searchUsers(query: string, limit = 8): Observable<{ data: UserRow[] | null; error: unknown }> {
    const sanitized = query.replace(/[,()%]/g, '').trim();
    if (!sanitized) return of({ data: [], error: null });
    return from(
      this.client
        .from('public_user_profiles')
        .select('uid,name,is_guest,reputation,created_at')
        .ilike('name', `%${sanitized}%`)
        .eq('is_guest', false)
        .limit(limit)
        .overrideTypes<UserRow[]>(),
    ).pipe(map((result) => this.requireSuccess(result)));
  }

  callRpc<T>(
    name: string,
    params: Record<string, unknown>,
  ): Observable<{ data: T | null; error: unknown }> {
    return from(this.client.rpc(name, params)).pipe(
      map((result) => this.requireSuccess(result)),
    ) as Observable<{ data: T | null; error: unknown }>;
  }

  upsertRow<T extends Record<string, unknown>>(table: string, data: T, onConflict?: string) {
    return from(this.client.from(table).upsert(data, onConflict ? { onConflict } : undefined)).pipe(
      map((result) => this.requireSuccess(result)),
    );
  }

  getRowsIn<T>(
    table: string,
    field: string,
    values: unknown[],
  ): Observable<{ data: T[] | null; error: unknown }> {
    if (!values.length) return of({ data: [], error: null });
    return from(
      this.client
        .from(table)
        .select('*')
        .in(field, values as (string | number)[]),
    ).pipe(map((result) => this.requireSuccess(result))) as Observable<{
      data: T[] | null;
      error: unknown;
    }>;
  }

  getLatest<T>(table: string, limit: number): Observable<{ data: T[] | null; error: unknown }> {
    return from(
      this.client.from(table).select('*').order('created_at', { ascending: false }).limit(limit),
    ).pipe(map((result) => this.requireSuccess(result))) as Observable<{
      data: T[] | null;
      error: unknown;
    }>;
  }

  getLatestPaginated<T>(
    table: string,
    limit: number,
    offset: number,
    search?: string,
    scope?: { tag?: string; postSubtype?: string },
  ): Observable<{ data: T[] | null; error: unknown }> {
    let query = this.client
      .from(table)
      .select('*')
      .eq('publish_status', 'published') // Step 5.A: public paginated feeds never include drafts/scheduled posts
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (scope?.tag) query = query.eq('tag', scope.tag);
    if (scope?.postSubtype) query = query.eq('post_subtype', scope.postSubtype);

    if (search) {
      const sanitized = search.replace(/[,()%]/g, '').trim();
      if (!sanitized) return of({ data: [], error: null });
      const searchTerm = `%${sanitized}%`;
      query = query.or(
        `highlight.ilike.${searchTerm},title.ilike.${searchTerm},username.ilike.${searchTerm},business_name.ilike.${searchTerm},tag.ilike.${searchTerm},hood_id.ilike.${searchTerm}`,
      );
    }

    return from(query).pipe(map((result) => this.requireSuccess(result))) as Observable<{
      data: T[] | null;
      error: unknown;
    }>;
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
      /** Business post_subtype filter — separate from `tags` (Step 4.B). */
      postSubtype?: string;
      /** Step 5.A: defaults to published-only; pass true only for an owner's own draft/scheduled list. */
      includeUnpublished?: boolean;
    },
    limit?: number,
    offset?: number,
  ): Observable<{ data: T[] | null; error: unknown }> {
    let query = this.client.from(table).select('*');

    if (!filters.includeUnpublished) {
      query = query.eq('publish_status', 'published');
    }
    if (filters.userId) {
      query = query.eq('user_id', filters.userId);
    }
    if (filters.hoodId) {
      query = query.eq('hood_id', filters.hoodId);
    }
    if (filters.tags && filters.tags.length > 0) {
      query = query.in('tag', filters.tags);
    }
    if (filters.postSubtype) {
      query = query.eq('post_subtype', filters.postSubtype);
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
      query = query.or(
        `highlight.ilike.${term},title.ilike.${term},username.ilike.${term},business_name.ilike.${term},tag.ilike.${term}`,
      );
    }

    query = query.order('created_at', { ascending: false });

    if (limit !== undefined && offset !== undefined) {
      query = query.range(offset, offset + limit - 1);
    } else if (limit !== undefined) {
      query = query.limit(limit);
    }

    return from(query).pipe(map((result) => this.requireSuccess(result))) as Observable<{
      data: T[] | null;
      error: unknown;
    }>;
  }

  fetchTagsInBounds(
    minLng: number,
    minLat: number,
    maxLng: number,
    maxLat: number,
  ): Observable<{ data: TagRow[] | null; error: unknown }> {
    return from(
      this.client.rpc('fetch_tags_in_bounds', {
        min_lng: minLng,
        min_lat: minLat,
        max_lng: maxLng,
        max_lat: maxLat,
      }),
    ).pipe(map((result) => this.requireSuccess(result))) as Observable<{
      data: TagRow[] | null;
      error: unknown;
    }>;
  }

  setUserActive() {
    return from(this.client.rpc('set_user_active')).pipe(
      map((result) => this.requireSuccess(result)),
    );
  }
}
