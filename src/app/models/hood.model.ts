import { Coords } from "./coords.model";

export class Hood {
    id: string = '';
    name: string = 'Marathahalli';
    country: string = 'India';
    coords: Coords = { lat: 12.952, lng: 77.700 };
    address: string = '';
    boundaries: number[] = [];

    constructor(init?: Partial<Hood>) {
        Object.assign(this, init);
    }
}
