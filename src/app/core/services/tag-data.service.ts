import { Injectable, inject } from '@angular/core';
import { Observable, from, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { SupabaseClientService } from './supabase-client.service';
import { AppUser, OpeningHoursEntry } from '../models/app-user.model';
import { Hood } from '../models/hood.model';
import { TagRow } from './tag.mapper';
import { UserRow } from './social.mapper';

@Injectable({ providedIn: 'root' })
export class TagDataService {
  private readonly clientService = inject(SupabaseClientService);
  private readonly client = this.clientService.client;
  /** Untyped view onto the same client, used only where `table`/`name` is a
   *  runtime string rather than a literal known at compile time — the
   *  generated `Database` type only accepts its own literal union, so a
   *  generic `string` can't satisfy `.from()`/`.rpc()` directly. Callers
   *  still get real typing via each method's own `<T>` generic and return
   *  cast. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly raw: any = this.client;

  private requireSuccess<T extends { error: unknown }>(result: T): T {
    if (result.error) throw result.error;
    return result;
  }

  /** Wraps a Supabase promise built via `this.raw` (necessarily untyped —
   *  see `raw` above) back into a typed Observable, so callers keep the
   *  `{ data, error }` shape TS can check without the `any` leaking out. */
  private wrap<T>(promise: unknown): Observable<T> {
    return from(promise as Promise<T>);
  }

  addRow<T>(table: string, data: Record<string, unknown>) {
    return this.wrap<{ data: T; error: unknown }>(
      this.raw.from(table).insert(data).select().single(),
    ).pipe(map((result) => this.requireSuccess(result)));
  }

  getRows<T>(
    table: string,
    condition?: { field: string; op: '=='; value: unknown },
  ): Observable<{ data: T[] | null; error: unknown }> {
    let query = this.raw.from(table).select('*');
    if (condition) {
      query = query.eq(condition.field, condition.value as string);
    }
    return this.wrap<{ data: T[] | null; error: unknown }>(query).pipe(
      map((result) => this.requireSuccess(result)),
    );
  }

  getRow<T>(table: string, id: string): Observable<{ data: T | null; error: unknown }> {
    return this.wrap<{ data: T | null; error: unknown }>(
      this.raw.from(table).select('*').eq('id', id).single(),
    ).pipe(map((result) => this.requireSuccess(result)));
  }

  getUserById(uid: string): Observable<AppUser | null> {
    return from(
      this.client
        .from('public_user_profiles')
        .select(
          'uid,name,avatar_url,is_guest,reputation,created_at,account_type,business_name,business_website,business_phone,business_category,business_images,business_established_year,bio,cover_image_url,opening_hours,google_maps_url,social_instagram,social_facebook,social_x,social_linkedin,social_youtube,social_whatsapp',
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
          'uid,name,email,avatar_url,is_guest,reputation,created_at,' +
            'home_state,home_country,home_district,home_place,home_lat,home_lng,home_updated_at,' +
            'account_type,business_name,business_phone,business_website,business_category,business_images,business_established_year,' +
            'bio,cover_image_url,opening_hours,google_maps_url,social_instagram,social_facebook,social_x,social_linkedin,social_youtube,social_whatsapp',
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
      avatarUrl: data.avatar_url ?? undefined,
      reputation: data.reputation ?? 0,
      createdAt: data.created_at ?? undefined,
      hood,
      accountType: data.account_type === 'business' ? 'business' : 'personal',
      businessName: data.business_name ?? undefined,
      businessPhone: data.business_phone ?? undefined,
      businessWebsite: data.business_website ?? undefined,
      businessCategory: data.business_category ?? undefined,
      businessImages: data.business_images ?? undefined,
      businessEstablishedYear: data.business_established_year ?? undefined,
      bio: data.bio ?? undefined,
      coverImageUrl: data.cover_image_url ?? undefined,
      openingHours: (data.opening_hours as OpeningHoursEntry[] | null) ?? undefined,
      googleMapsUrl: data.google_maps_url ?? undefined,
      socialInstagram: data.social_instagram ?? undefined,
      socialFacebook: data.social_facebook ?? undefined,
      socialX: data.social_x ?? undefined,
      socialLinkedin: data.social_linkedin ?? undefined,
      socialYoutube: data.social_youtube ?? undefined,
      socialWhatsapp: data.social_whatsapp ?? undefined,
    };
  }

  updateRow<T>(table: string, id: string, data: Partial<T>) {
    return this.wrap<{ data: T; error: unknown }>(
      this.raw
        .from(table)
        .update(data as Record<string, unknown>)
        .eq('id', id)
        .select()
        .single(),
    ).pipe(map((result) => this.requireSuccess(result)));
  }

  deleteRow(table: string, id: string) {
    return this.wrap<{ error: unknown }>(this.raw.from(table).delete().eq('id', id)).pipe(
      map((result) => this.requireSuccess(result)),
    );
  }

  deleteRowsWhere(table: string, matchers: Record<string, unknown>) {
    return this.wrap<{ error: unknown }>(this.raw.from(table).delete().match(matchers)).pipe(
      map((result) => this.requireSuccess(result)),
    );
  }

  updateRowsWhere<T>(table: string, matchers: Record<string, unknown>, data: Partial<T>) {
    return this.wrap<{ error: unknown }>(
      this.raw
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
    return this.wrap<{ data: T | null; error: unknown }>(this.raw.rpc(name, params)).pipe(
      map((result) => this.requireSuccess(result)),
    );
  }

  upsertRow<T extends Record<string, unknown>>(table: string, data: T, onConflict?: string) {
    return this.wrap<{ error: unknown }>(
      this.raw.from(table).upsert(data, onConflict ? { onConflict } : undefined),
    ).pipe(map((result) => this.requireSuccess(result)));
  }

  getRowsIn<T>(
    table: string,
    field: string,
    values: unknown[],
    columns = '*',
  ): Observable<{ data: T[] | null; error: unknown }> {
    if (!values.length) return of({ data: [], error: null });
    return this.wrap<{ data: T[] | null; error: unknown }>(
      this.raw
        .from(table)
        .select(columns)
        .in(field, values as (string | number)[]),
    ).pipe(map((result) => this.requireSuccess(result)));
  }

  getLatest<T>(table: string, limit: number): Observable<{ data: T[] | null; error: unknown }> {
    return this.wrap<{ data: T[] | null; error: unknown }>(
      this.raw.from(table).select('*').order('created_at', { ascending: false }).limit(limit),
    ).pipe(map((result) => this.requireSuccess(result)));
  }

  getLatestPaginated<T>(
    table: string,
    limit: number,
    offset: number,
    search?: string,
    scope?: { tag?: string; postSubtype?: string; state?: string; country?: string },
  ): Observable<{ data: T[] | null; error: unknown }> {
    let query = this.raw
      .from(table)
      .select('*')
      .eq('publish_status', 'published') // Step 5.A: public paginated feeds never include drafts/scheduled posts
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (scope?.tag) query = query.eq('tag', scope.tag);
    if (scope?.postSubtype) query = query.eq('post_subtype', scope.postSubtype);
    // Case-insensitive since stored casing isn't guaranteed consistent across posts.
    if (scope?.state) query = query.ilike('state', scope.state);
    if (scope?.country) query = query.ilike('country', scope.country);

    if (search) {
      const sanitized = search.replace(/[,()%]/g, '').trim();
      if (!sanitized) return of({ data: [], error: null });
      const searchTerm = `%${sanitized}%`;
      query = query.or(
        `highlight.ilike.${searchTerm},title.ilike.${searchTerm},username.ilike.${searchTerm},business_name.ilike.${searchTerm},tag.ilike.${searchTerm},hood_id.ilike.${searchTerm}`,
      );
    }

    return this.wrap<{ data: T[] | null; error: unknown }>(query).pipe(
      map((result) => this.requireSuccess(result)),
    );
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
    let query = this.raw.from(table).select('*');

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

    return this.wrap<{ data: T[] | null; error: unknown }>(query).pipe(
      map((result) => this.requireSuccess(result)),
    );
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
