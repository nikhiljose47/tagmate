import { createReducer, on } from '@ngrx/store';
import { ActionReducer } from '@ngrx/store';
import { setUserPreference } from './user-preference.actions';
import { UserPreference } from '../../core/models/user-preference.model';
import { Hood } from '../../core/models/hood.model';

const HOOD_KEY = 'tagmate_hood';

function readStoredHood(): Hood {
  if (typeof window === 'undefined') return new Hood();
  try {
    const raw = localStorage.getItem(HOOD_KEY);
    return raw ? new Hood(JSON.parse(raw) as Partial<Hood>) : new Hood();
  } catch {
    return new Hood();
  }
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
  on(setUserPreference, (state, { pref }) => ({ ...state, ...pref }))
);

/** Meta-reducer: writes hood to localStorage whenever it changes. */
export function hoodPersistMetaReducer(reducer: ActionReducer<any>): ActionReducer<any> {
  return (state, action) => {
    const next = reducer(state, action);
    if (typeof window !== 'undefined') {
      const prevHood = state?.userPref?.hood;
      const nextHood = next?.userPref?.hood;
      if (nextHood && nextHood !== prevHood) {
        try { localStorage.setItem(HOOD_KEY, JSON.stringify(nextHood)); } catch {}
      }
    }
    return next;
  };
}
