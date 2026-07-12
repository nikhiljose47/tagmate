import { provideHttpClient } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideStore } from '@ngrx/store';
import { of } from 'rxjs';
import { toggleReducer } from './store/toggle/toggle.state';
import { userPrefReducer } from './store/user-preferences/user-preference.reducer';
import { TAG_REPOSITORY } from './core/repositories/repository.tokens';

// To mock SupabaseService in individual specs:
// { provide: SupabaseService, useValue: jasmine.createSpyObj('SupabaseService',
//   ['signInWithPassword', 'signInAnonymously', 'signOut', 'addRow', 'getRows', 'deleteRow'],
//   { session$: of(null) }) }
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
    useValue: {
      getAll: () => of([]),
      getFiltered: () => of([]),
      getPaginated: () => of([]),
      getById: () => of(null),
      getByUserId: () => of([]),
      getInBounds: () => of([]),
      liveTags: () => of(),
      liveTagUpdates: () => of(),
      update: () => of({}),
      create: () => of({}),
      delete: () => of(undefined),
    },
  },
];
