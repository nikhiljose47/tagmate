import { Injectable, inject } from '@angular/core';
import { Observable, map, retry } from 'rxjs';
import { Tag } from '../../models/tag.model';
import { SupabaseService } from '../../services/supabase.service';
import { tagToRow, rowToTag, TagRow } from '../../services/tag.mapper';
import { BoundingBox, ITagRepository } from '../interfaces/tag.repository';

@Injectable({ providedIn: 'root' })
export class SupabaseTagRepository implements ITagRepository {
  private readonly supabase = inject(SupabaseService);

  getAll(): Observable<Tag[]> {
    return this.supabase
      .getLatest<TagRow>('tags', 50)
      .pipe(map(({ data }) => (data ?? []).map(rowToTag)));
  }

  getPaginated(limit: number, offset: number, search?: string): Observable<Tag[]> {
    return this.supabase
      .getLatestPaginated<TagRow>('tags', limit, offset, search)
      .pipe(
        retry({ count: 3, delay: 2000 }),
        map(({ data }) => (data ?? []).map(rowToTag))
      );
  }

  getById(id: string): Observable<Tag | null> {
    return this.supabase
      .getRow<TagRow>('tags', id)
      .pipe(map(({ data }) => (data ? rowToTag(data) : null)));
  }

  getByUserId(userId: string): Observable<Tag[]> {
    return this.supabase
      .getRows<TagRow>('tags', { field: 'user_id', op: '==', value: userId })
      .pipe(map(({ data }) => (data ?? []).map(rowToTag)));
  }

  getInBounds(box: BoundingBox): Observable<Tag[]> {
    return this.supabase
      .fetchTagsInBounds(box.minLng, box.minLat, box.maxLng, box.maxLat)
      .pipe(map(({ data }) => (data ?? []).map(rowToTag)));
  }

  liveTags(): Observable<Tag> {
    return this.supabase.liveInserts<TagRow>('tags').pipe(map(rowToTag));
  }

  create(tag: Omit<Tag, 'id'>): Observable<Tag> {
    return this.supabase
      .addRow('tags', tagToRow(tag as Tag) as Record<string, unknown>)
      .pipe(
        retry({ count: 3, delay: 2000 }),
        map(({ data }) => rowToTag(data as unknown as TagRow))
      );
  }

  delete(id: string): Observable<void> {
    return this.supabase.deleteRow('tags', id).pipe(
      retry({ count: 3, delay: 2000 }),
      map(() => undefined)
    );
  }
}
