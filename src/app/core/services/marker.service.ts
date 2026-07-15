import { Injectable } from '@angular/core';
import type { FeatureCollection, Point } from 'geojson';
import type { GeoJSONSource } from 'maplibre-gl';

/** The common map position and identity required for a renderable marker. */
export interface MapMarker {
  id: string;
  longitude: number;
  latitude: number;
}

/** Builds and updates GeoJSON marker sources without coupling feature pages to MapLibre. */
@Injectable({ providedIn: 'root' })
export class MarkerService {
  toFeatureCollection<TMarker extends MapMarker, TProperties extends object>(
    markers: TMarker[],
    toProperties: (marker: TMarker) => TProperties,
  ): FeatureCollection<Point, TProperties> {
    return {
      type: 'FeatureCollection',
      features: markers.map((marker) => ({
        type: 'Feature',
        properties: toProperties(marker),
        geometry: {
          type: 'Point',
          coordinates: [marker.longitude, marker.latitude],
        },
      })),
    };
  }

  setSourceData<TMarker extends MapMarker, TProperties extends object>(
    source: GeoJSONSource | undefined,
    markers: TMarker[],
    toProperties: (marker: TMarker) => TProperties,
  ): void {
    source?.setData(this.toFeatureCollection(markers, toProperties));
  }
}
