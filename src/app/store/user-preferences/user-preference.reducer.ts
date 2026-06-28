import { createReducer, on } from '@ngrx/store';
import { setUserPreference } from './user-preference.actions';
import { UserPreference } from '../../core/models/user-preference.model';
import { Hood } from '../../core/models/hood.model';


export const initialUserPref: UserPreference = {
    theme: 'light',
    language: 'en',
    mapZoom: 10,
    mapCenter: [0, 0],
    hood: new Hood(),
};


export const userPrefReducer = createReducer(
    initialUserPref,
    on(setUserPreference, (state, { pref }) => ({ ...state, ...pref }))
);