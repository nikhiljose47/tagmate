import { BehaviorSubject, Observable, Subject, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { Tag } from '../../models/tag.model';
import { BoundingBox, ITagRepository } from '../interfaces/tag.repository';

/**
 * A hermetic, stateful in-memory implementation of ITagRepository for unit testing.
 * Maintains tags reactively in memory without external database calls.
 */
export class InMemoryTagRepository implements ITagRepository {
  private readonly tags$ = new BehaviorSubject<Tag[]>([]);
  private readonly tagCreated$ = new Subject<Tag>();
  private readonly tagUpdated$ = new Subject<Tag>();

  constructor(initialTags: Tag[] = []) {
    this.tags$.next(initialTags);
  }

  /** Seed or reset tags in memory */
  setTags(tags: Tag[]): void {
    this.tags$.next([...tags]);
  }

  /** Access current snapshot of tags in memory */
  get snapshot(): Tag[] {
    return this.tags$.value;
  }

  getAll(): Observable<Tag[]> {
    return this.tags$.asObservable();
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
    },
    limit?: number,
    offset?: number,
  ): Observable<Tag[]> {
    return this.tags$.pipe(
      map((all) => {
        let result = [...all];

        if (filters?.tags && filters.tags.length > 0) {
          result = result.filter((t) => t.tag && filters.tags!.includes(t.tag));
        }

        if (filters?.excludeTag) {
          result = result.filter((t) => t.tag !== filters.excludeTag);
        }

        if (filters?.userId) {
          result = result.filter((t) => t.userId === filters.userId);
        }

        if (filters?.hoodId) {
          result = result.filter((t) => t.hoodId === filters.hoodId);
        }

        if (filters?.search) {
          const q = filters.search.toLowerCase();
          result = result.filter(
            (t) =>
              t.highlight.toLowerCase().includes(q) ||
              t.username.toLowerCase().includes(q) ||
              t.tag?.toLowerCase().includes(q),
          );
        }

        if (filters?.before) {
          const beforeDate = new Date(filters.before).getTime();
          result = result.filter((t) => new Date(t.createdAt).getTime() < beforeDate);
        }

        if (filters?.after) {
          const afterDate = new Date(filters.after).getTime();
          result = result.filter((t) => new Date(t.createdAt).getTime() > afterDate);
        }

        const start = offset ?? 0;
        const end = limit ? start + limit : undefined;
        return result.slice(start, end);
      }),
    );
  }

  getPaginated(limit: number, offset: number, search?: string): Observable<Tag[]> {
    return this.getFiltered({ search }, limit, offset);
  }

  getById(id: string): Observable<Tag | null> {
    return this.tags$.pipe(map((all) => all.find((t) => t.id === id) ?? null));
  }

  getByUserId(userId: string): Observable<Tag[]> {
    return this.getFiltered({ userId });
  }

  getInBounds(box: BoundingBox): Observable<Tag[]> {
    return this.tags$.pipe(
      map((all) =>
        all.filter(
          (t) =>
            t.lng >= box.minLng &&
            t.lng <= box.maxLng &&
            t.lat >= box.minLat &&
            t.lat <= box.maxLat,
        ),
      ),
    );
  }

  liveTags(): Observable<Tag> {
    return this.tagCreated$.asObservable();
  }

  liveTagUpdates(): Observable<Tag> {
    return this.tagUpdated$.asObservable();
  }

  create(tagInput: Omit<Tag, 'id'>): Observable<Tag> {
    const created: Tag = {
      ...tagInput,
      id: `tag-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    };

    const current = this.tags$.value;
    this.tags$.next([created, ...current]);
    this.tagCreated$.next(created);

    return of(created);
  }

  update(id: string, partial: Partial<Omit<Tag, 'id' | 'userId' | 'createdAt'>>): Observable<Tag> {
    const current = this.tags$.value;
    const index = current.findIndex((t) => t.id === id);

    if (index === -1) {
      throw new Error(`Tag not found: ${id}`);
    }

    const existing = current[index];
    if (!existing) throw new Error(`Tag not found: ${id}`);
    const updated: Tag = { ...existing, ...partial };
    const newList = [...current];
    newList[index] = updated;

    this.tags$.next(newList);
    this.tagUpdated$.next(updated);

    return of(updated);
  }

  delete(id: string): Observable<void> {
    const current = this.tags$.value;
    this.tags$.next(current.filter((t) => t.id !== id));
    return of(undefined);
  }
}
