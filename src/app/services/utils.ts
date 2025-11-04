import { Injectable } from '@angular/core';
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
}
