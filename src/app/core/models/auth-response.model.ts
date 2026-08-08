export interface AuthSuccessResponse {
  ok: true;
  uid: string;
  email: string | null;
  username: string;
  /**
   * True when Supabase created the account but the project requires email
   * confirmation before a session is issued (signUp returns a user with no
   * session in that case). Callers should show a "check your inbox" state
   * instead of treating this like a normal signed-in success.
   */
  needsEmailConfirmation?: boolean;
}

export interface AuthErrorResponse {
  ok: false;
  code: string;
  message: string;
}

export type AuthResponse = AuthSuccessResponse | AuthErrorResponse;
