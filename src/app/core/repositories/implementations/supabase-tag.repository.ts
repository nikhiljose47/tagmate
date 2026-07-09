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

  getFiltered(filters?: {
    tags?: string[];
    before?: string;
    after?: string;
    userId?: string;
    search?: string;
    excludeTag?: string;
    hoodId?: string;
  }, limit?: number, offset?: number): Observable<Tag[]> {
    return this.tagData
      .getFilteredRows<TagRow>('tags', filters || {}, limit, offset)
      .pipe(map(({ data }) => (data ?? []).map(rowToTag)));
  }

  getPaginated(limit: number, offset: number, search?: string): Observable<Tag[]> {
    return this.tagData
      .getLatestPaginated<TagRow>('tags', limit, offset, search)
      .pipe(
        retry({ count: 3, delay: 2000 }),
        map(({ data }) => (data ?? []).map(rowToTag))
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

  update(id: string, partial: Partial<Omit<Tag, 'id' | 'userId' | 'createdAt'>>): Observable<Tag> {
    const row: Partial<TagRow> = {};
    if (partial.username !== undefined) row.username = partial.username;
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

    return this.tagData
      .updateRow<TagRow>('tags', id, row)
      .pipe(
        map(({ data }) => rowToTag(data as unknown as TagRow))
      );
  }

  create(tag: Omit<Tag, 'id'>): Observable<Tag> {
    return this.tagData
      .addRow('tags', tagToRow(tag as Tag) as Record<string, unknown>)
      .pipe(
        retry({ count: 3, delay: 2000 }),
        map(({ data }) => rowToTag(data as unknown as TagRow))
      );
  }

  delete(id: string): Observable<void> {
    return this.tagData.deleteRow('tags', id).pipe(
      retry({ count: 3, delay: 2000 }),
      map(() => undefined)
    );
  }
}
