import { Injectable, inject, signal } from '@angular/core';
import { Hood } from '../models/hood.model';
import { Tag } from '../models/tag.model';
import { TagDataService } from './tag-data.service';
import { rowToTag, TagRow } from './tag.mapper';

const HOOD_KEY   = 'tagmate_hood';
const CACHE_TTL  = 60_000;
const DELTA      = 0.12; // ~13 km radius around hood centre

@Injectable({ providedIn: 'root' })
export class PreloadService {
  private readonly tagData = inject(TagDataService);

  private _globePosts: Tag[] | null   = null;
  private _globeTs    = 0;
  private _hoodPosts: Tag[] | null    = null;
  private _hoodTs     = 0;

  /** Emits true once the globe feed batch has arrived (or errored). */
  readonly globeReady = signal(false);

  /** Call once on app start. Runs all prefetches in parallel. */
  prefetch(): void {
    this.prefetchGlobe();
    this.prefetchHood();
  }

  /**
   * Returns the pre-fetched globe posts, if available.
   * Calling this does NOT consume/clear them — it's safe to call many times.
   */
  getGlobePosts(): Tag[] | null {
    if (this._globePosts !== null && Date.now() - this._globeTs < CACHE_TTL) {
      return this._globePosts;
    }
    return null;
  }

  /**
   * Returns the pre-fetched hood posts if still within TTL, null otherwise.
   */
  getHoodPosts(): Tag[] | null {
    if (this._hoodPosts !== null && Date.now() - this._hoodTs < CACHE_TTL) {
      return this._hoodPosts;
    }
    return null;
  }

  // ── private ──────────────────────────────────────────────────────────────

  private prefetchGlobe(): void {
    this.tagData.getLatest<TagRow>('tags', 50).subscribe({
      next: ({ data }) => {
        this._globePosts = (data ?? []).map(rowToTag);
        this._globeTs    = Date.now();
        this.globeReady.set(true);
      },
      error: () => { this.globeReady.set(true); },
    });
  }

  private prefetchHood(): void {
    const { lat, lng } = this.readStoredHood().coords;
    this.tagData
      .fetchTagsInBounds(lng - DELTA, lat - DELTA, lng + DELTA, lat + DELTA)
      .subscribe({
        next: ({ data }) => {
          this._hoodPosts = (data ?? []).map(rowToTag);
          this._hoodTs    = Date.now();
        },
        error: () => {},
      });
  }

  private readStoredHood(): Hood {
    if (typeof window === 'undefined') return new Hood();
    try {
      const raw = localStorage.getItem(HOOD_KEY);
      return raw ? new Hood(JSON.parse(raw) as Partial<Hood>) : new Hood();
    } catch {
      return new Hood();
    }
  }
}
