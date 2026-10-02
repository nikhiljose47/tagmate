import { createReducer, on } from '@ngrx/store';
import { ActionReducer } from '@ngrx/store';
import { setUserPreference } from './user-preference.actions';
import { UserPreference } from '../../core/models/user-preference.model';
import { Hood } from '../../core/models/hood.model';
import { readLocalStorage, writeLocalStorage } from '../../core/utils/local-storage.util';
import { AppState } from '../../state/app.state';

const HOOD_KEY = 'tagmate:device:hood';

function readStoredHood(): Hood {
  return new Hood(readLocalStorage<Partial<Hood>>(HOOD_KEY, {}));
}

export const initialUserPref: UserPreference = {
  theme: 'light',
  language: 'en',
  mapZoom: 15,
  mapCenter: [0, 0],
  hood: readStoredHood(),
};

export const userPrefReducer = createReducer(
  initialUserPref,
  on(setUserPreference, (state, { pref }) => ({ ...state, ...pref })),
);

/**
 * Meta-reducer: writes hood to localStorage whenever a `setUserPreference`
 * actually changes it. Keying off the action type (rather than comparing
 * before/after hood references) matters here: NgRx's own init action also
 * produces a "new" hood reference the first time the reducer runs — keying
 * off reference identity would persist the hardcoded placeholder default to
 * localStorage on every app boot, before anything had a chance to detect or
 * ask for the user's real location.
 */
export function hoodPersistMetaReducer(reducer: ActionReducer<AppState>): ActionReducer<AppState> {
  return (state, action) => {
    const next = reducer(state, action);
    if (action.type !== setUserPreference.type) return next;
    const nextHood = next?.userPref?.hood;
    if (nextHood) writeLocalStorage(HOOD_KEY, nextHood);
    return next;
  };
}
