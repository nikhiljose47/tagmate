import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import type { MultiPolygon, Polygon } from 'geojson';
import type { LngLatBoundsLike } from 'maplibre-gl';

type BoundaryGeometry = Polygon | MultiPolygon;

export interface PlaceBoundary {
  geometry: BoundaryGeometry;
  bounds: LngLatBoundsLike;
}

interface NominatimPlace {
  geojson?: {
    type: string;
    coordinates: unknown;
  };
  boundingbox?: [string, string, string, string];
}

@Injectable({
  providedIn: 'root',
})
export class Utils {
  private allCards: unknown[] = [];
  private visibleCards = new BehaviorSubject<unknown[]>([]);

  cards$ = this.visibleCards.asObservable();

  setAllCards(data: unknown[]): void {
    this.allCards = data;
  }

  startRandomPopup(intervalMs = 2000): void {
    setInterval(() => {
      if (this.allCards.length > 0) {
        const randomIndex = Math.floor(Math.random() * this.allCards.length);
        const randomCard = this.allCards[randomIndex];
        this.visibleCards.next([...this.visibleCards.getValue(), randomCard]);
      }
    }, intervalMs);
  }

  getRandom(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  startTimer(seconds: number, onTick: (s: number) => void, onComplete: () => void): void {
    let remaining = seconds;

    const interval = setInterval(() => {
      remaining--;
      onTick(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        onComplete();
      }
    }, 1000);
  }

  static async getPlaceBoundary(query: string): Promise<PlaceBoundary | null> {
    const url = `https://nominatim.openstreetmap.org/search?format=json&polygon_geojson=1&q=${encodeURIComponent(
      query
    )}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Boundary lookup failed with status ${res.status}`);
    }

    const result = (await res.json()) as NominatimPlace[];
    if (!result.length) return null;

    const place = result[0];
    const bounds = this.getBoundsFromBoundingBox(place.boundingbox);
    if (!bounds) return null;

    if (place.geojson && this.isBoundaryGeometry(place.geojson)) {
      return {
        geometry: place.geojson,
        bounds,
      };
    }

    return {
      geometry: this.createRectangleGeometry(place.boundingbox),
      bounds,
    };
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

    const south = Number.parseFloat(box[0]);
    const north = Number.parseFloat(box[1]);
    const west = Number.parseFloat(box[2]);
    const east = Number.parseFloat(box[3]);

    if (![south, north, west, east].every(Number.isFinite)) return null;
    return [
      [west, south],
      [east, north],
    ];
  }

  private static createRectangleGeometry(box: NominatimPlace['boundingbox']): Polygon {
    if (!box) {
      return {
        type: 'Polygon',
        coordinates: [[]],
      };
    }

    const south = Number.parseFloat(box[0]);
    const north = Number.parseFloat(box[1]);
    const west = Number.parseFloat(box[2]);
    const east = Number.parseFloat(box[3]);

    return {
      type: 'Polygon',
      coordinates: [
        [
          [west, south],
          [east, south],
          [east, north],
          [west, north],
          [west, south],
        ],
      ],
    };
  }
}
