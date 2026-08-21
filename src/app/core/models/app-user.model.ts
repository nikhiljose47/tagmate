import { Hood } from './hood.model';

export type AccountType = 'personal' | 'business';

export interface AppUser {
  uid: string;
  name: string;
  isGuest: boolean;
  email?: string;
  bio?: string;
  /** Profile picture — a business logo for business accounts, a normal avatar otherwise. */
  avatarUrl?: string;
  createdAt?: string;
  updatedAt?: string;
  /** Trigger-maintained server-side (bumped by likes on this user's posts) — never write this from the client. */
  reputation?: number;
  /** Home hood from the users table. Absent until the row is loaded. */
  hood?: Hood;
  /** 'personal' unless the user signed up (or was converted) as a business account. */
  accountType: AccountType;
  /** Shop/business display name — set only when accountType === 'business'. */
  businessName?: string;
  /** Optional business contact info, shown on business-style post cards when set. */
  businessPhone?: string;
  businessWebsite?: string;
  /** Fixed tag category the business registered under (see TagCategory) — set
   *  only when accountType === 'business'. Every post the account makes uses
   *  this tag; there's no per-post tag picker for business accounts. */
  businessCategory?: string;
  /** 1–5 shop/business photo URLs (tag-images bucket). */
  businessImages?: string[];
  /** Year the business was founded — collected at signup instead of a personal birthday. */
  businessEstablishedYear?: number;
}
