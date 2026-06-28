import { createAction, props } from '@ngrx/store';
import { UserPreference } from '../../core/models/user-preference.model';


export const loadUserPreference = createAction('[UserPref] Load');
export const setUserPreference = createAction(
    '[UserPref] Set',
    props<{ pref: Partial<UserPreference> }>()
);