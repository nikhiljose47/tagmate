import { PostStatus } from './tag.model';

export interface SocialProfile {
  uid: string;
  name: string;
  bio: string;
  reputation: number;
  createdAt?: string;
  updatedAt?: string;
}

export type FollowTargetType = 'user' | 'hood' | 'topic';

export interface FollowTarget {
  type: FollowTargetType;
  id: string;
}

export interface FollowState {
  users: ReadonlySet<string>;
  hoods: ReadonlySet<string>;
  topics: ReadonlySet<string>;
}

export interface PostConfirmation {
  postId: string;
  userId: string;
  userName?: string;
  createdAt: string;
}

export interface PostStatusEntry {
  id: string;
  postId: string;
  actorId?: string;
  actorName?: string;
  status: PostStatus;
  note?: string;
  createdAt: string;
}

export const ACTIONABLE_TAGS = new Set([
  'alert', 'traffic', 'weather', 'utility', 'event', 'sale', 'market',
  'shopping', 'business', 'health', 'question',
]);

export function allowedStatusesForTag(tag: string): readonly PostStatus[] {
  return tag === 'question'
    ? ['active', 'closed']
    : ['active', 'resolved', 'cancelled'];
}
