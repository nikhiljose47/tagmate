import { Coords } from './coords.model';

export class Hood {
  id: string = '';
  name: string = 'Marathahalli';
  country: string = 'India';
  state: string = 'Karnataka';
  district: string = 'Bangalore Urban';
  /** Optional finer-grained locality (suburb, neighbourhood, village…). */
  place: string = '';
  coords: Coords = { lat: 12.952, lng: 77.7 };
  address: string = '';
  boundaries: number[] = [];
  /** ISO timestamp of the last server-side home hood change; empty if unknown. */
  updatedAt: string = '';

  constructor(init?: Partial<Hood>) {
    Object.assign(this, init);
  }
}
