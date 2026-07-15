import { Injectable } from '@angular/core';
import { deviceStorageKey, readLocalStorage, writeLocalStorage } from '../utils/local-storage.util';

const TEMPLATES_KEY = deviceStorageKey('island-templates');

/** Validated persistence boundary for Hood Island display templates. */
@Injectable({ providedIn: 'root' })
export class MapTemplateStoreService {
  load<T extends { id: string }>(isValid: (value: unknown) => value is T): T[] {
    const values = readLocalStorage<unknown[]>(TEMPLATES_KEY, []);
    return values.filter(isValid);
  }

  save<T extends { id: string }>(templates: T[]): void {
    writeLocalStorage(TEMPLATES_KEY, templates);
  }
}
