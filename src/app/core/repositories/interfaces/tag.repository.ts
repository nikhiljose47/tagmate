import { Observable } from 'rxjs';
import { Tag } from '../../models/tag.model';

export interface BoundingBox {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

export interface ITagRepository {
  getAll(): Observable<Tag[]>;
  getFiltered(
    filters?: {
      tags?: string[];
      before?: string; // ISO date
      after?: string;
      userId?: string;
      search?: string;
      excludeTag?: string;
      hoodId?: string;
      /** Business post_subtype filter — separate from `tags` (Step 4.B). */
      postSubtype?: string;
      /**
       * Step 5.A: normal calls only ever get published posts. Pass `true` only
       * for an owner's own draft/scheduled list — never for public listings.
       */
      includeUnpublished?: boolean;
    },
    limit?: number,
    offset?: number,
  ): Observable<Tag[]>;
  /**
   * `scope` is optional and additive (Step 4.B) — existing 3-arg call sites
   * behave exactly as before. When supplied, `tag`/`postSubtype` are pushed
   * down to the query instead of always loading unrelated posts.
   */
  getPaginated(
    limit: number,
    offset: number,
    search?: string,
    scope?: { tag?: string; postSubtype?: string },
  ): Observable<Tag[]>;
  getById(id: string): Observable<Tag | null>;
  getByUserId(userId: string): Observable<Tag[]>;
  getInBounds(box: BoundingBox): Observable<Tag[]>;
  liveTags(): Observable<Tag>;
  liveTagUpdates(): Observable<Tag>;
  update(id: string, partial: Partial<Omit<Tag, 'id' | 'userId' | 'createdAt'>>): Observable<Tag>;
  create(tag: Omit<Tag, 'id'>): Observable<Tag>;
  delete(id: string): Observable<void>;
}
