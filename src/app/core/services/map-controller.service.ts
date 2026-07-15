import { Injectable } from '@angular/core';
import type { Map as MapLibreMap } from 'maplibre-gl';

/** Owns map resize observation and deterministic map teardown. */
@Injectable({ providedIn: 'root' })
export class MapControllerService {
  private resizeObserver?: ResizeObserver;
  private map?: MapLibreMap;

  attach(map: MapLibreMap, container: HTMLElement): void {
    this.destroy();
    this.map = map;
    this.resizeObserver = new ResizeObserver(() => this.map?.resize());
    this.resizeObserver.observe(container);
  }

  destroy(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    this.map?.remove();
    this.map = undefined;
  }
}
