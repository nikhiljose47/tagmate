import { ToggleState } from "../store/toggle/toggle.state";
import { UserPreference } from "../core/models/user-preference.model";

export interface AppState {
  toggle: ToggleState;
  userPref: UserPreference;
}
