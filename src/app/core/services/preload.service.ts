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
import { MapStyleService } from '../map/map-style.service';

const HOOD_KEY = deviceStorageKey('hood');
const LEGACY_HOOD_KEY = 'tagmate_hood';
const CACHE_TTL = 60_000;
const DELTA = 0.12; // ~13 km radius around hood centre

@Injectable({ providedIn: 'root' })
export class PreloadService {
  private readonly tagData = inject(TagDataService);
  private readonly mapStyle = inject(MapStyleService);

  private _hoodPosts: Tag[] | null = null;
  private _hoodTs = 0;

  /** Call once on app start. */
  prefetch(): void {
    this.prefetchHood();
  }

  /**
   * Call once on app start, browser only. Uses idle time (after the splash's
   * more urgent prefetch work) to spin up MapLibre's shared WebWorkers ahead
   * of the first map mount, and to start fetching the Liberty style + its
   * TileJSON so it's already cached by the time any map needs it.
   */
  prewarmMaps(): void {
    const schedule =
      typeof requestIdleCallback === 'function'
        ? requestIdleCallback
        : (cb: () => void) => setTimeout(cb, 1000);

    schedule(() => {
      void import('maplibre-gl').then((mod) => {
        (mod.default ?? mod).prewarm();
      });
      void this.mapStyle.getLibertyStyle();
    });
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
