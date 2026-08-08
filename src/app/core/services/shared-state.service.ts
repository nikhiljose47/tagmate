import { Injectable, signal, computed } from '@angular/core';

export type SelectedCoordinates = readonly [lat: number, lng: number] | null;

/** In-progress post form, kept alive while the user detours to the map to pick a location. */
export interface PostDraft {
  postType: 'personal' | 'business';
  headline: string;
  expiresIn: number;
  tag: string;
  intent: string;
  price: string;
  originalPrice: string;
  availabilityNote: string;
  cta: string;
  productLink: string;
  isEvent: boolean;
  eventStart: string;
  eventEnd: string;
  pollOptions: string[];
  templateValues: Record<string, string>;
  media: { file: File; previewUrl: string; type: 'image' | 'video' }[];
  /** Where to land when this draft is restored — 'preview' for "Post Again" (nothing to review). */
  resumeStep?: 'details' | 'preview';
}

@Injectable({ providedIn: 'root' })
export class SharedStateService {
  /** Set from PostPage before navigating to Hood for pick-location flow */
  readonly pickModeActive = signal(false);

  /** Survives PostPage destroy/recreate during the pick-location round-trip. */
  readonly postDraft = signal<PostDraft | null>(null);

  /** How the location was selected: 'place' (search) or 'pinpoint' (map tap / GPS). */
  readonly locationType = signal<'place' | 'pinpoint'>('pinpoint');

  private _text = signal<string>('');
  private _coordinates = signal<SelectedCoordinates>(null);
  private _userDeviceCoords = signal<SelectedCoordinates>(null);
  /** Admin-1 region (e.g. "Kerala"). Populated from the same reverse-geocode
      response as `text`; used at post creation time to persist state on the tag. */
  private _state = signal<string>('');
  private _country = signal<string>('');

  readonly text = computed(() => this._text());
  readonly coordinates = computed(() => this._coordinates());
  readonly userDeviceCoords = computed(() => this._userDeviceCoords());
  readonly state = computed(() => this._state());
  readonly country = computed(() => this._country());

  updateText(value: string): void {
    this._text.set(value);
  }

  updateCoordinates(lat: number, lng: number): void {
    this._coordinates.set([lat, lng]);
  }

  updateRegion(state: string, country: string): void {
    this._state.set(state ?? '');
    this._country.set(country ?? '');
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
        { timeout: 10000, maximumAge: 60000, enableHighAccuracy: true },
      );
    });
  }

  clear(): void {
    this._text.set('');
    this._coordinates.set(null);
    this._state.set('');
    this._country.set('');
    this.locationType.set('pinpoint');
  }
}
