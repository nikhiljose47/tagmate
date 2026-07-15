import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import type { MultiPolygon, Polygon, Position } from 'geojson';
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
      return { geometry: this.simplifyBoundary(place.geojson), bounds };
    }

    return { geometry: this.createRectangleGeometry(place.boundingbox), bounds };
  }

  private static isBoundaryGeometry(
    geometry: NominatimPlace['geojson'],
  ): geometry is BoundaryGeometry {
    return geometry?.type === 'Polygon' || geometry?.type === 'MultiPolygon';
  }

  static getBoundsFromBoundingBox(box: NominatimPlace['boundingbox']): LngLatBoundsLike | null {
    if (!box) return null;
    const [s, n, w, e] = box.map(Number.parseFloat);
    if (![s, n, w, e].every(Number.isFinite)) return null;
    return [
      [w, s],
      [e, n],
    ];
  }

  static createRectangleGeometry(box: NominatimPlace['boundingbox']): Polygon {
    if (!box) return { type: 'Polygon', coordinates: [[]] };
    const [s, n, w, e] = box.map(Number.parseFloat);
    return {
      type: 'Polygon',
      coordinates: [
        [
          [w, s],
          [e, s],
          [e, n],
          [w, n],
          [w, s],
        ],
      ],
    };
  }

  /**
   * Keeps externally supplied administrative boundaries cheap enough to render
   * on mobile. Nominatim can return rings with many thousands of vertices;
   * MapLibre otherwise has to repeatedly tessellate those raw coordinates.
   */
  static simplifyBoundary(geometry: BoundaryGeometry, tolerance = 0.00002): BoundaryGeometry {
    const simplifyPolygon = (polygon: Position[][]): Position[][] =>
      polygon.map((ring) => this.simplifyRing(ring, tolerance));

    return geometry.type === 'Polygon'
      ? { type: 'Polygon', coordinates: simplifyPolygon(geometry.coordinates) }
      : { type: 'MultiPolygon', coordinates: geometry.coordinates.map(simplifyPolygon) };
  }

  private static simplifyRing(ring: Position[], tolerance: number): Position[] {
    if (ring.length <= 4) return ring;
    const closed =
      ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1];
    const points = closed ? ring.slice(0, -1) : ring.slice();
    if (points.length < 3) return ring;

    const squaredTolerance = tolerance * tolerance;
    const keep = new Uint8Array(points.length);
    keep[0] = 1;
    keep[points.length - 1] = 1;
    const pending: Array<[number, number]> = [[0, points.length - 1]];

    while (pending.length) {
      const [start, end] = pending.pop()!;
      let maxDistance = squaredTolerance;
      let index = -1;
      for (let i = start + 1; i < end; i++) {
        const distance = this.squaredSegmentDistance(points[i], points[start], points[end]);
        if (distance > maxDistance) {
          maxDistance = distance;
          index = i;
        }
      }
      if (index !== -1) {
        keep[index] = 1;
        pending.push([start, index], [index, end]);
      }
    }

    const simplified = points.filter((_, index) => keep[index]);
    // A polygon needs at least three distinct points plus its closing point.
    return simplified.length >= 3 ? [...simplified, simplified[0]] : ring;
  }

  private static squaredSegmentDistance(point: Position, start: Position, end: Position): number {
    const dx = end[0] - start[0];
    const dy = end[1] - start[1];
    if (dx === 0 && dy === 0) {
      const px = point[0] - start[0];
      const py = point[1] - start[1];
      return px * px + py * py;
    }
    const t = Math.max(
      0,
      Math.min(1, ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / (dx * dx + dy * dy)),
    );
    const px = point[0] - (start[0] + t * dx);
    const py = point[1] - (start[1] + t * dy);
    return px * px + py * py;
  }
}
