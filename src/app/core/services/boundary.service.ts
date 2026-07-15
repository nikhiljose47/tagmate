import { Injectable } from '@angular/core';
import { PlaceBoundary, Utils } from './utils.service';
import { deviceStorageKey, readLocalStorage, writeLocalStorage } from '../utils/local-storage.util';

const BOUNDARY_CACHE_KEY = deviceStorageKey('map-boundary-cache');
const CACHE_LIMIT = 50;

/** Shared Nominatim-boundary cache with a single normalization and eviction policy. */
@Injectable({ providedIn: 'root' })
export class BoundaryService {
  getCached(...keys: string[]): PlaceBoundary | null {
    const cache = new Map(readLocalStorage<[string, PlaceBoundary][]>(BOUNDARY_CACHE_KEY, []));
    for (const key of keys) {
      const boundary = cache.get(key.toLowerCase());
      if (boundary) return boundary;
    }
    return null;
  }

  async resolve(query: string, ...fallbackKeys: string[]): Promise<PlaceBoundary | null> {
    const cached = this.getCached(query, ...fallbackKeys);
    if (cached) return cached;
    const boundary = await Utils.getPlaceBoundary(query);
    if (boundary) this.setCached(query, boundary);
    return boundary;
  }

  setCached(key: string, boundary: PlaceBoundary): void {
    const cache = new Map(readLocalStorage<[string, PlaceBoundary][]>(BOUNDARY_CACHE_KEY, []));
    const normalizedKey = key.toLowerCase();
    cache.delete(normalizedKey);
    cache.set(normalizedKey, boundary);
    while (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value!);
    writeLocalStorage(BOUNDARY_CACHE_KEY, Array.from(cache.entries()));
  }
}
