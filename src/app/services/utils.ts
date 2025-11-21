import { Injectable } from '@angular/core';
import L, { Layer, LayerGroup, Marker } from 'leaflet';
import { BehaviorSubject } from 'rxjs';

export type PlaceLayer = L.GeoJSON | L.Rectangle | null;

@Injectable({
  providedIn: 'root',
})
export class Utils {
  private allCards: any[] = [];
  private visibleCards = new BehaviorSubject<any[]>([]);

  cards$ = this.visibleCards.asObservable();

  setAllCards(data: any[]) {
    this.allCards = data;
  }

  startRandomPopup(intervalMs = 2000) {
    setInterval(() => {
      if (this.allCards.length > 0) {
        const randomIndex = Math.floor(Math.random() * this.allCards.length);
        const randomCard = this.allCards[randomIndex];
        this.visibleCards.next([...this.visibleCards.getValue(), randomCard]);
      }
    }, intervalMs);
  }

  drawCircle(lat: number, lng: number, radius: number, L: any): L.Circle {
    return L.circle([lat, lng], {
      radius,
      color: '#007bff1e',
      weight: 1,
      fillColor: '#007bff',
      fillOpacity: 0.25,
    });
  }

  getIcon(iconName: string, L: any): L.Icon {
    return L.icon({
      iconUrl: `assets/icons/${iconName}.svg`, // local path
      iconSize: [15, 15],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      className: 'custom-marker',
    });
  }

  getRandom(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  startTimer(seconds: number, onTick: (s: number) => void, onComplete: () => void) {
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

  static async getPlaceLayer(L: any, query: string): Promise<PlaceLayer | null> {
    const url = `https://nominatim.openstreetmap.org/search?format=json&polygon_geojson=1&q=${query}`;
    const res = await fetch(url);
    const result = await res.json();

    if (!result || result.length === 0) return null;
    const place = result[0];

    // 1️⃣ If polygon exists → return polygon layer
    if (place.geojson) {
      return L.geoJSON(place.geojson, {
        style: {
          color: 'blue',
          weight: 2,
          fillOpacity: 0.1,
        },
      });
    }

    // 2️⃣ Else → return rectangle from bounding box
    const box = place.boundingbox; // [south, north, west, east]

    const south = parseFloat(box[0]);
    const north = parseFloat(box[1]);
    const west = parseFloat(box[2]);
    const east = parseFloat(box[3]);

    const bounds = [
      [south, west],
      [north, east],
    ];

    return L.rectangle(bounds, {
      color: 'blue',
      weight: 2,
      fillOpacity: 0.1,
    });
  }
}
