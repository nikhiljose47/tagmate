import { Hood } from './hood.model';

export interface AppUser {
  uid: string;
  name: string;
  isGuest: boolean;
  email?: string;
  bio?: string;
  createdAt?: string;
  updatedAt?: string;
  /** Trigger-maintained server-side (bumped by likes on this user's posts) — never write this from the client. */
  reputation?: number;
  /** Home hood from the users table. Absent until the row is loaded. */
  hood?: Hood;
}
