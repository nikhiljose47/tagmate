export interface AppUser {
  uid: string;
  name: string;
  isGuest: boolean;
  email?: string;
  /** Trigger-maintained server-side (bumped by likes on this user's posts) — never write this from the client. */
  reputation?: number;
}
