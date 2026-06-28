import { Injectable, signal, computed } from '@angular/core';

export type SelectedCoordinates = readonly [lat: number, lng: number] | null;

@Injectable({ providedIn: 'root' })
export class SharedStateService {
  /** Set from PostPage before navigating to Hood for pick-location flow */
  readonly pickModeActive = signal(false);

  private _text = signal<string>('');
  private _coordinates = signal<SelectedCoordinates>(null);

  readonly text = computed(() => this._text());
  readonly coordinates = computed(() => this._coordinates());

  updateText(value: string): void {
    this._text.set(value);
  }

  updateCoordinates(lat: number, lng: number): void {
    this._coordinates.set([lat, lng]);
  }

  clear(): void {
    this._text.set('');
    this._coordinates.set(null);
  }
}
