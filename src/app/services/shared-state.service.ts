import { Injectable, signal, computed } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class SharedStateService {
  // writable signal for input text
  private _text = signal<string>('');
  private _cd = signal<number[]>([]);

  // public readonly accessors
  readonly text = computed(() => this._text());
  readonly coordinates = computed(() => this._cd());

  // method to update text
  updateText(value: string) {
    this._text.set(value);
  }

  updateCoordinates(lat: number, long: number){
    this._cd.set([lat, long]);
  }

  // optional clear/reset
  clear() {
    this._text.set('');
    this._cd.set([]);
  }
}
