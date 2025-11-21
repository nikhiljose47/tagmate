import { Hood } from "./hood.model";

export interface UserPreference {
theme: 'light' | 'dark';
language: string;
mapZoom: number;
mapCenter: [number, number];
hood: Hood,
}
