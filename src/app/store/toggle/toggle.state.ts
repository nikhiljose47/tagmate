import { createAction, createReducer, on, props } from '@ngrx/store';

export const setToggle = createAction(
  '[Toggle] Set',
  props<{ key: string; value: boolean }>()
);

export interface ToggleState {
  toggles: Record<string, boolean>;
}

export const initialState: ToggleState = {
  toggles: {
    'shouldAddPost': false
  }
};

export const toggleReducer = createReducer(
  initialState,
  on(setToggle, (state, { key, value }) => ({
    ...state,
    toggles: { ...state.toggles, [key]: value }
  }))
);
