import { provideHttpClient } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideStore } from '@ngrx/store';
import { toggleReducer } from './store/toggle/toggle.state';
import { userPrefReducer } from './store/user-preferences/user-preference.reducer';
import { TAG_REPOSITORY } from './core/repositories/repository.tokens';
import { InMemoryTagRepository } from './core/repositories/implementations/in-memory-tag.repository';

export const testProviders = [
  provideZonelessChangeDetection(),
  provideHttpClient(),
  provideRouter([]),
  provideStore({
    toggle: toggleReducer,
    userPref: userPrefReducer,
  }),
  {
    provide: TAG_REPOSITORY,
    useClass: InMemoryTagRepository,
  },
];
