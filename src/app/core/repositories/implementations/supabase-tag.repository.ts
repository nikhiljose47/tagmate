import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
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

  create(tag: Omit<Tag, 'id'>): Observable<Tag> {
    return this.supabase
      .addRow('tags', tagToRow(tag as Tag) as Record<string, unknown>)
      .pipe(map(({ data }) => rowToTag(data as unknown as TagRow)));
  }

  delete(id: string): Observable<void> {
    return this.supabase.deleteRow('tags', id).pipe(map(() => undefined));
  }
}
