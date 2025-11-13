import { Injectable } from '@angular/core';
import L, { Layer, Marker } from 'leaflet';
import { BehaviorSubject } from 'rxjs';

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
        this.visibleCards.next([
          ...this.visibleCards.getValue(),
          randomCard
        ]);
      }
    }, intervalMs);
  }

  getIcon(iconName: string, L: any): L.Icon {
    return L.icon({
      iconUrl: `assets/icons/${iconName}.png`, // local path
      iconSize: [15, 15],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      className: 'custom-marker'
    });
  }
}
