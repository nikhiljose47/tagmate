import { Injectable, signal, computed } from '@angular/core';

export type SelectedCoordinates = readonly [lat: number, lng: number] | null;

/** In-progress post form, kept alive while the user detours to the map to pick a location. */
export interface PostDraft {
  headline:    string;
  expiresIn:   number;
  tag:         string;
  isEvent:     boolean;
  eventStart:  string;
  eventEnd:    string;
  pollOptions: string[];
  media:       { file: File; previewUrl: string; type: 'image' | 'video' }[];
}

@Injectable({ providedIn: 'root' })
export class SharedStateService {
  /** Set from PostPage before navigating to Hood for pick-location flow */
  readonly pickModeActive = signal(false);

  /** Survives PostPage destroy/recreate during the pick-location round-trip. */
  readonly postDraft = signal<PostDraft | null>(null);

  private _text = signal<string>('');
  private _coordinates = signal<SelectedCoordinates>(null);
  private _userDeviceCoords = signal<SelectedCoordinates>(null);

  readonly text = computed(() => this._text());
  readonly coordinates = computed(() => this._coordinates());
  readonly userDeviceCoords = computed(() => this._userDeviceCoords());

  updateText(value: string): void {
    this._text.set(value);
  }

  updateCoordinates(lat: number, lng: number): void {
    this._coordinates.set([lat, lng]);
  }

  async getDeviceCoordinates(): Promise<SelectedCoordinates> {
    const cached = this._userDeviceCoords();
    if (cached) return cached;
    if (typeof navigator === 'undefined' || !navigator.geolocation) return null;

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
          const next: SelectedCoordinates = [coords.latitude, coords.longitude];
          this._userDeviceCoords.set(next);
          resolve(next);
        },
        () => resolve(null),
        { timeout: 10000, maximumAge: 60000, enableHighAccuracy: true }
      );
    });
  }

  clear(): void {
    this._text.set('');
    this._coordinates.set(null);
  }
}
