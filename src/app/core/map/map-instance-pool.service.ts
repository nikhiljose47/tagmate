import { Injectable } from '@angular/core';
import type { Map as MapLibreMap } from 'maplibre-gl';

export interface PooledMapEntry {
  map: MapLibreMap;
  /** The map's own container div — kept detached from the DOM while pooled. */
  container: HTMLDivElement;
}

/**
 * Two live WebGL contexts is a reasonable ceiling for a phone-class device;
 * beyond that the memory/GPU cost outweighs the reuse benefit.
 */
const MAX_POOLED_MAPS = 2;

/**
 * Keeps MapLibre map instances alive (with their tiles, sources and layers
 * already loaded) across navigation instead of destroying and rebuilding
 * them, so returning to a screen with a map shows it instantly. Callers
 * `put()` their map when navigating away and `take()` it back when they
 * return; a map that's never reclaimed is evicted (and torn down) once a
 * 3rd entry would exceed the pool's cap, oldest-touched first.
 */
@Injectable({ providedIn: 'root' })
export class MapInstancePoolService {
  private readonly pool = new Map<string, PooledMapEntry>();
  private readonly contextLossBound = new WeakSet<MapLibreMap>();

  /** Removes and returns the pooled map for `key`, or undefined if none is pooled. */
  take(key: string): PooledMapEntry | undefined {
    const entry = this.pool.get(key);
    if (entry) this.pool.delete(key);
    return entry;
  }

  /**
   * Detaches the entry's container from the DOM and stashes the map for
   * later reuse. Re-inserting on every `put` keeps `pool`'s iteration order
   * as least-recently-put-first, so eviction below removes the coldest entry.
   */
  put(key: string, entry: PooledMapEntry): void {
    entry.container.remove();
    this.pool.delete(key);
    this.pool.set(key, entry);
    this.bindContextLoss(entry);
    this.evictOverflow();
  }

  /** Tears down and forgets every pooled map — used on full app/session teardown. */
  clear(): void {
    for (const entry of this.pool.values()) entry.map.remove();
    this.pool.clear();
  }

  private bindContextLoss(entry: PooledMapEntry): void {
    if (this.contextLossBound.has(entry.map)) return;
    this.contextLossBound.add(entry.map);
    entry.map.getCanvas().addEventListener('webglcontextlost', () => {
      for (const [k, v] of this.pool) {
        if (v.map === entry.map) {
          this.pool.delete(k);
          break;
        }
      }
    });
  }

  private evictOverflow(): void {
    while (this.pool.size > MAX_POOLED_MAPS) {
      const oldestKey = this.pool.keys().next().value;
      if (oldestKey === undefined) break;
      const oldest = this.pool.get(oldestKey);
      this.pool.delete(oldestKey);
      oldest?.map.remove();
    }
  }
}
