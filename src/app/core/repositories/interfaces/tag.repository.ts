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
  getFiltered(filters?: {
    tags?: string[];
    before?: string;    // ISO date
    after?: string;
    userId?: string;
    search?: string;
    excludeTag?: string;
    hoodId?: string;
  }, limit?: number, offset?: number): Observable<Tag[]>;
  getPaginated(limit: number, offset: number, search?: string): Observable<Tag[]>;
  getById(id: string): Observable<Tag | null>;
  getByUserId(userId: string): Observable<Tag[]>;
  getInBounds(box: BoundingBox): Observable<Tag[]>;
  liveTags(): Observable<Tag>;
  liveTagUpdates(): Observable<Tag>;
  update(id: string, partial: Partial<Omit<Tag, 'id' | 'userId' | 'createdAt'>>): Observable<Tag>;
  create(tag: Omit<Tag, 'id'>): Observable<Tag>;
  delete(id: string): Observable<void>;
}
