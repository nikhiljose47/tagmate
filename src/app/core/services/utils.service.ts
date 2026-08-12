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

/** Static boundary helpers shared by the map and boundary services. */
export class Utils {
  static async getPlaceBoundary(query: string): Promise<PlaceBoundary | null> {
    const url = `/api/nominatim/boundary?q=${encodeURIComponent(query)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Boundary lookup failed with status ${res.status}`);

    const result = (await res.json()) as NominatimPlace[];
    if (!result.length) return null;

    const place = result[0];
    if (!place) return null;
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
    const values = box.map(Number.parseFloat);
    if (values.length !== 4 || !values.every(Number.isFinite)) return null;
    const [s, n, w, e] = values as [number, number, number, number];
    return [
      [w, s],
      [e, n],
    ];
  }

  static createRectangleGeometry(box: NominatimPlace['boundingbox']): Polygon {
    if (!box) return { type: 'Polygon', coordinates: [[]] };
    const values = box.map(Number.parseFloat) as [number, number, number, number];
    const [s, n, w, e] = values;
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
    const first = ring[0]!;
    const last = ring[ring.length - 1]!;
    const closed = first[0] === last[0] && first[1] === last[1];
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
        const distance = this.squaredSegmentDistance(points[i]!, points[start]!, points[end]!);
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
    return simplified.length >= 3 ? [...simplified, simplified[0]!] : ring;
  }

  private static squaredSegmentDistance(point: Position, start: Position, end: Position): number {
    if (point.length < 2 || start.length < 2 || end.length < 2) return 0;
    const endX = end[0]!;
    const endY = end[1]!;
    const startX = start[0]!;
    const startY = start[1]!;
    const pointX = point[0]!;
    const pointY = point[1]!;
    const dx = endX - startX;
    const dy = endY - startY;
    if (dx === 0 && dy === 0) {
      const px = pointX - startX;
      const py = pointY - startY;
      return px * px + py * py;
    }
    const t = Math.max(
      0,
      Math.min(1, ((pointX - startX) * dx + (pointY - startY) * dy) / (dx * dx + dy * dy)),
    );
    const px = pointX - (startX + t * dx);
    const py = pointY - (startY + t * dy);
    return px * px + py * py;
  }
}
