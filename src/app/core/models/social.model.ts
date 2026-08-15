import { PostStatus, Tag } from './tag.model';

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

export const ACTIONABLE_TAGS = new Set(['alert', 'help', 'event', 'shop', 'biz', 'health', 'poll']);

/** Business post_subtype ids that make a post actionable (status/RSVP-eligible)
 *  even when the parent category isn't itself in ACTIONABLE_TAGS. Step 4.B —
 *  e.g. a Food business's "Looking For" or "Event" post is actionable despite
 *  `food` not being in ACTIONABLE_TAGS. */
const ACTIONABLE_SUBTYPES = new Set(['event', 'job', 'looking_for']);

/** Centralized actionability check — considers both the parent category and,
 *  for business posts, the specific subtype. Never changes the stored tag. */
export function isActionablePost(post: Pick<Tag, 'tag' | 'postSubtype'>): boolean {
  if (post.postSubtype && ACTIONABLE_SUBTYPES.has(post.postSubtype)) return true;
  return ACTIONABLE_TAGS.has(post.tag);
}

/** True for the legacy personal 'event' category or any business post using
 *  an event-style subtype — used to gate the event/RSVP box. Step 4.B. */
export function isEventLikePost(post: Pick<Tag, 'tag' | 'postSubtype'>): boolean {
  return post.tag === 'event' || post.postSubtype === 'event';
}

export function allowedStatusesForTag(tag: string): readonly PostStatus[] {
  return tag === 'poll' ? ['active', 'closed'] : ['active', 'resolved', 'cancelled'];
}
