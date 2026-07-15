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

/** Meta-reducer: writes hood to localStorage whenever it changes. */
export function hoodPersistMetaReducer(reducer: ActionReducer<AppState>): ActionReducer<AppState> {
  return (state, action) => {
    const next = reducer(state, action);
    const prevHood = state?.userPref?.hood;
    const nextHood = next?.userPref?.hood;
    if (nextHood && nextHood !== prevHood) {
      writeLocalStorage(HOOD_KEY, nextHood);
    }
    return next;
  };
}
