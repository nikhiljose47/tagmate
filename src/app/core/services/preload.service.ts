import { Injectable, inject } from '@angular/core';
import { Hood } from '../models/hood.model';
import { Tag } from '../models/tag.model';
import { TagDataService } from './tag-data.service';
import { rowToTag } from './tag.mapper';
import {
  deviceStorageKey,
  migrateLocalStorageKey,
  readLocalStorage,
} from '../utils/local-storage.util';

const HOOD_KEY = deviceStorageKey('hood');
const LEGACY_HOOD_KEY = 'tagmate_hood';
const CACHE_TTL = 60_000;
const DELTA = 0.12; // ~13 km radius around hood centre

@Injectable({ providedIn: 'root' })
export class PreloadService {
  private readonly tagData = inject(TagDataService);

  private _hoodPosts: Tag[] | null = null;
  private _hoodTs = 0;

  /** Call once on app start. */
  prefetch(): void {
    this.prefetchHood();
  }

  /** Returns the pre-fetched hood posts if still within TTL, null otherwise. */
  getHoodPosts(): Tag[] | null {
    if (this._hoodPosts !== null && Date.now() - this._hoodTs < CACHE_TTL) {
      return this._hoodPosts;
    }
    return null;
  }

  // ── private ──────────────────────────────────────────────────────────────

  private prefetchHood(): void {
    const { lat, lng } = this.readStoredHood().coords;
    this.tagData.fetchTagsInBounds(lng - DELTA, lat - DELTA, lng + DELTA, lat + DELTA).subscribe({
      next: ({ data }) => {
        this._hoodPosts = (data ?? []).map(rowToTag);
        this._hoodTs = Date.now();
      },
      error: () => {},
    });
  }

  private readStoredHood(): Hood {
    migrateLocalStorageKey(LEGACY_HOOD_KEY, HOOD_KEY);
    return new Hood(readLocalStorage<Partial<Hood>>(HOOD_KEY, {}));
  }
}
