import { provideHttpClient } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideStore } from '@ngrx/store';
import { toggleReducer } from './store/toggle/toggle.state';
import { userPrefReducer } from './store/user-preferences/user-preference.reducer';

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
];
