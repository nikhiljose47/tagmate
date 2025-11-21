import { createSelector, createFeatureSelector } from '@ngrx/store';
import { UserPreference } from '../../models/user-preference.model';


export const selectUserPrefState = createFeatureSelector<UserPreference>('userPref');


export const selectTheme = createSelector(selectUserPrefState, s => s.theme);
export const selectLanguage = createSelector(selectUserPrefState, s => s.language);
export const selectMapZoom = createSelector(selectUserPrefState, s => s.mapZoom);
export const selectMapCenter = createSelector(selectUserPrefState, s => s.mapCenter);
export const selectHood = createSelector(selectUserPrefState, s => s.hood);