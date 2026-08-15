import { Injectable, inject } from '@angular/core';
import { Observable, map, retry } from 'rxjs';
import { Tag } from '../../models/tag.model';
import { TagDataService } from '../../services/tag-data.service';
import { RealtimeService } from '../../services/realtime.service';
import { tagToRow, rowToTag, TagRow } from '../../services/tag.mapper';
import { BoundingBox, ITagRepository } from '../interfaces/tag.repository';

@Injectable({ providedIn: 'root' })
export class SupabaseTagRepository implements ITagRepository {
  private readonly tagData = inject(TagDataService);
  private readonly realtime = inject(RealtimeService);

  getAll(): Observable<Tag[]> {
    return this.tagData
      .getLatest<TagRow>('tags', 50)
      .pipe(map(({ data }) => (data ?? []).map(rowToTag)));
  }

  getFiltered(
    filters?: {
      tags?: string[];
      before?: string;
      after?: string;
      userId?: string;
      search?: string;
      excludeTag?: string;
      hoodId?: string;
      postSubtype?: string;
    },
    limit?: number,
    offset?: number,
  ): Observable<Tag[]> {
    return this.tagData
      .getFilteredRows<TagRow>('tags', filters || {}, limit, offset)
      .pipe(map(({ data }) => (data ?? []).map(rowToTag)));
  }

  getPaginated(
    limit: number,
    offset: number,
    search?: string,
    scope?: { tag?: string; postSubtype?: string },
  ): Observable<Tag[]> {
    return this.tagData.getLatestPaginated<TagRow>('tags', limit, offset, search, scope).pipe(
      retry({ count: 3, delay: 2000 }),
      map(({ data }) => (data ?? []).map(rowToTag)),
    );
  }

  getById(id: string): Observable<Tag | null> {
    return this.tagData
      .getRow<TagRow>('tags', id)
      .pipe(map(({ data }) => (data ? rowToTag(data) : null)));
  }

  getByUserId(userId: string): Observable<Tag[]> {
    return this.tagData
      .getRows<TagRow>('tags', { field: 'user_id', op: '==', value: userId })
      .pipe(map(({ data }) => (data ?? []).map(rowToTag)));
  }

  getInBounds(box: BoundingBox): Observable<Tag[]> {
    return this.tagData
      .fetchTagsInBounds(box.minLng, box.minLat, box.maxLng, box.maxLat)
      .pipe(map(({ data }) => (data ?? []).map(rowToTag)));
  }

  liveTags(): Observable<Tag> {
    return this.realtime.liveInserts<TagRow>('tags').pipe(map(rowToTag));
  }

  liveTagUpdates(): Observable<Tag> {
    return this.realtime.liveUpdates<TagRow>('tags').pipe(map(rowToTag));
  }

  update(id: string, partial: Partial<Omit<Tag, 'id' | 'userId' | 'createdAt'>>): Observable<Tag> {
    const row: Partial<TagRow> = {};
    if (partial.username !== undefined) row.username = partial.username;
    if (partial.businessName !== undefined) row.business_name = partial.businessName;
    if (partial.businessPhone !== undefined) row.business_phone = partial.businessPhone;
    if (partial.businessWebsite !== undefined) row.business_website = partial.businessWebsite;
    if (partial.postType !== undefined) row.post_type = partial.postType;
    if (partial.intent !== undefined) row.intent = partial.intent;
    if (partial.price !== undefined) row.price = partial.price;
    if (partial.originalPrice !== undefined) row.original_price = partial.originalPrice;
    if (partial.availabilityNote !== undefined) row.availability_note = partial.availabilityNote;
    if (partial.cta !== undefined) row.cta = partial.cta;
    if (partial.productLink !== undefined) row.product_link = partial.productLink;
    if (partial.highlight !== undefined) row.highlight = partial.highlight;
    if (partial.lat !== undefined) row.lat = partial.lat;
    if (partial.lng !== undefined) row.lng = partial.lng;
    if (partial.expiresIn !== undefined) row.expires_in = partial.expiresIn;
    if (partial.tag !== undefined) row.tag = partial.tag;
    if (partial.images !== undefined) row.images = partial.images;
    if (partial.hoodId !== undefined) row.hood_id = partial.hoodId;
    if (partial.country !== undefined) row.country = partial.country;
    if (partial.loves !== undefined) row.loves = partial.loves;
    if (partial.dislikes !== undefined) row.dislikes = partial.dislikes;
    if (partial.comments !== undefined) row.comments = partial.comments;
    if (partial.pollOptions !== undefined) row.poll_options = partial.pollOptions;
    if (partial.pollVotes !== undefined) row.poll_votes = partial.pollVotes;
    if (partial.eventStart !== undefined) row.event_start = partial.eventStart;
    if (partial.eventEnd !== undefined) row.event_end = partial.eventEnd;
    // Step 1 template fields
    if (partial.postSubtype !== undefined) row.post_subtype = partial.postSubtype;
    if (partial.templateVersion !== undefined) row.template_version = partial.templateVersion;
    if (partial.title !== undefined) row.title = partial.title;
    if (partial.templateData !== undefined) row.template_data = partial.templateData;
    // Step 5.A publishing state — updated_at is trigger-maintained, never client-set.
    if (partial.publishStatus !== undefined) row.publish_status = partial.publishStatus;
    if (partial.publishedAt !== undefined) row.published_at = partial.publishedAt;
    if (partial.scheduledFor !== undefined) row.scheduled_for = partial.scheduledFor;

    return this.tagData.updateRow<TagRow>('tags', id, row).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        if (!data) throw new Error('Update failed: no data returned');
        return rowToTag(data);
      }),
    );
  }

  create(tag: Omit<Tag, 'id'>): Observable<Tag> {
    return this.tagData.addRow<TagRow>('tags', tagToRow(tag)).pipe(
      map(({ data }) => {
        if (!data) throw new Error('Create failed: no row returned');
        return rowToTag(data);
      }),
    );
  }

  delete(id: string): Observable<void> {
    return this.tagData.deleteRow('tags', id).pipe(map(() => undefined));
  }
}
