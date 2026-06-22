export interface AuthSuccessResponse {
  ok: true;
  uid: string;
  email: string | null;
  username: string;
}

export interface AuthErrorResponse {
  ok: false;
  code: string;
  message: string;
}

export type AuthResponse = AuthSuccessResponse | AuthErrorResponse;
