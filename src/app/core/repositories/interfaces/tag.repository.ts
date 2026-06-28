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
  getByUserId(userId: string): Observable<Tag[]>;
  getInBounds(box: BoundingBox): Observable<Tag[]>;
  create(tag: Omit<Tag, 'id'>): Observable<Tag>;
  delete(id: string): Observable<void>;
}
