import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import type { MultiPolygon, Polygon } from 'geojson';
import type { LngLatBoundsLike } from 'maplibre-gl';

type BoundaryGeometry = Polygon | MultiPolygon;

export interface PlaceBoundary {
  geometry: BoundaryGeometry;
  bounds: LngLatBoundsLike;
}

interface NominatimPlace {
  geojson?: { type: string; coordinates: unknown };
  boundingbox?: [string, string, string, string];
}

/** Miscellaneous utilities: card stream + static geocoding helpers. */
@Injectable({ providedIn: 'root' })
export class Utils implements OnDestroy {
  private allCards: unknown[] = [];
  private visibleCards = new BehaviorSubject<unknown[]>([]);
  private randomPopupInterval?: ReturnType<typeof setInterval>;

  cards$ = this.visibleCards.asObservable();

  setAllCards(data: unknown[]): void {
    this.allCards = data;
  }

  startRandomPopup(intervalMs = 2000): () => void {
    this.stopRandomPopup();
    this.randomPopupInterval = setInterval(() => {
      if (this.allCards.length > 0) {
        const randomIndex = Math.floor(Math.random() * this.allCards.length);
        const randomCard = this.allCards[randomIndex];
        this.visibleCards.next([...this.visibleCards.getValue(), randomCard]);
      }
    }, intervalMs);
    return () => this.stopRandomPopup();
  }

  stopRandomPopup(): void {
    if (!this.randomPopupInterval) return;
    clearInterval(this.randomPopupInterval);
    this.randomPopupInterval = undefined;
  }

  getRandom(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  startTimer(seconds: number, onTick: (s: number) => void, onComplete: () => void): () => void {
    let remaining = seconds;
    const interval = setInterval(() => {
      remaining--;
      onTick(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        onComplete();
      }
    }, 1000);
    return () => clearInterval(interval);
  }

  ngOnDestroy(): void {
    this.stopRandomPopup();
  }

  static async getPlaceBoundary(query: string): Promise<PlaceBoundary | null> {
    const url = `/api/nominatim/boundary?q=${encodeURIComponent(query)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Boundary lookup failed with status ${res.status}`);

    const result = (await res.json()) as NominatimPlace[];
    if (!result.length) return null;

    const place = result[0];
    const bounds = this.getBoundsFromBoundingBox(place.boundingbox);
    if (!bounds) return null;

    if (place.geojson && this.isBoundaryGeometry(place.geojson)) {
      return { geometry: place.geojson, bounds };
    }

    return { geometry: this.createRectangleGeometry(place.boundingbox), bounds };
  }

  private static isBoundaryGeometry(
    geometry: NominatimPlace['geojson']
  ): geometry is BoundaryGeometry {
    return geometry?.type === 'Polygon' || geometry?.type === 'MultiPolygon';
  }

  private static getBoundsFromBoundingBox(
    box: NominatimPlace['boundingbox']
  ): LngLatBoundsLike | null {
    if (!box) return null;
    const [s, n, w, e] = box.map(Number.parseFloat);
    if (![s, n, w, e].every(Number.isFinite)) return null;
    return [[w, s], [e, n]];
  }

  private static createRectangleGeometry(box: NominatimPlace['boundingbox']): Polygon {
    if (!box) return { type: 'Polygon', coordinates: [[]] };
    const [s, n, w, e] = box.map(Number.parseFloat);
    return {
      type: 'Polygon',
      coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]],
    };
  }
}
