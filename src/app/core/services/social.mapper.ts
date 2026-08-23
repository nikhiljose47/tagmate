import {
  DirectMessage,
  HoodMessage,
  LocalNotification,
  ThreadedComment,
} from '../models/tag.model';

/** `users` row used by profile lookup and search queries. */
export interface UserRow {
  uid: string;
  name: string;
  email?: string | null;
  avatar_url?: string | null;
  is_guest: boolean;
  reputation: number | null;
  bio?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  home_state?: string | null;
  home_country?: string | null;
  home_district?: string | null;
  home_place?: string | null;
  home_lat?: number | null;
  home_lng?: number | null;
  home_updated_at?: string | null;
  account_type?: string | null;
  business_name?: string | null;
  business_phone?: string | null;
  business_website?: string | null;
  business_category?: string | null;
  business_images?: string[] | null;
  business_established_year?: number | null;
  cover_image_url?: string | null;
  opening_hours?: unknown;
  google_maps_url?: string | null;
  social_instagram?: string | null;
  social_facebook?: string | null;
  social_x?: string | null;
  social_linkedin?: string | null;
  social_youtube?: string | null;
  social_whatsapp?: string | null;
}

/** `business_offers` row (snake_case, matches the Supabase table). */
export interface BusinessOfferRow {
  id: string;
  user_id: string;
  image_url: string | null;
  title: string;
  description: string | null;
  valid_until: string;
  created_at: string;
}

export interface BusinessOffer {
  id: string;
  userId: string;
  imageUrl?: string;
  title: string;
  description?: string;
  validUntil: string;
  createdAt: string;
}

export function rowToBusinessOffer(row: BusinessOfferRow): BusinessOffer {
  return {
    id: row.id,
    userId: row.user_id,
    imageUrl: row.image_url ?? undefined,
    title: row.title,
    description: row.description ?? undefined,
    validUntil: row.valid_until,
    createdAt: row.created_at,
  };
}

/** `business_items` row (snake_case, matches the Supabase table). */
export interface BusinessItemRow {
  id: string;
  user_id: string;
  image_url: string | null;
  name: string;
  description: string | null;
  price: number | null;
  offer_price: number | null;
  created_at: string;
}

export interface BusinessItem {
  id: string;
  userId: string;
  imageUrl?: string;
  name: string;
  description?: string;
  price?: number;
  offerPrice?: number;
  createdAt: string;
}

export function rowToBusinessItem(row: BusinessItemRow): BusinessItem {
  return {
    id: row.id,
    userId: row.user_id,
    imageUrl: row.image_url ?? undefined,
    name: row.name,
    description: row.description ?? undefined,
    price: row.price ?? undefined,
    offerPrice: row.offer_price ?? undefined,
    createdAt: row.created_at,
  };
}

/** `post_comments` row (snake_case, matches the Supabase table). */
export interface PostCommentRow {
  id: string;
  post_id: string;
  parent_id: string | null;
  author_uid: string;
  author_name: string;
  text: string;
  mentions: string[];
  upvotes: number;
  created_at: string;
  updated_at?: string | null;
  deleted_at?: string | null;
}

/** Backward-compatible name for a `post_comments` table row. */
export type CommentRow = PostCommentRow;

export interface HoodMessageRow {
  id: string;
  hood_id: string;
  user_id: string;
  username: string;
  text: string;
  created_at: string;
}

export function rowToHoodMessage(row: HoodMessageRow): HoodMessage {
  return {
    id: row.id,
    hoodId: row.hood_id,
    userId: row.user_id,
    username: row.username,
    text: row.text,
    createdAt: row.created_at,
  };
}

export function rowToComment(row: PostCommentRow): ThreadedComment {
  return {
    id: row.id,
    postId: row.post_id,
    author: row.author_name,
    authorUid: row.author_uid,
    text: row.text,
    createdAt: row.created_at,
    upvotes: row.upvotes,
    mentions: row.mentions ?? [],
    parentId: row.parent_id ?? undefined,
    updatedAt: row.updated_at ?? undefined,
    deletedAt: row.deleted_at ?? undefined,
  };
}

/** `direct_messages` row (snake_case, matches the Supabase table). */
export interface DirectMessageRow {
  id: string;
  thread_id: string;
  post_id: string | null;
  from_uid: string;
  to_uid: string;
  to_name: string;
  text: string;
  read: boolean;
  read_at?: string | null;
  created_at: string;
}

/**
 * The row has no `from_name` column — the app only ever sends messages as the
 * current viewer today (no inbox UI for messages from others yet), so `from`
 * resolves to "You" when the viewer is the sender and falls back to the
 * recipient's stored name otherwise. Revisit if a "view replies" UI ships.
 */
export function rowToDirectMessage(row: DirectMessageRow, viewerUid: string | null): DirectMessage {
  return {
    id: row.id,
    threadId: row.thread_id,
    postId: row.post_id ?? '',
    from: row.from_uid === viewerUid ? 'You' : row.to_name,
    to: row.to_name,
    fromUid: row.from_uid,
    toUid: row.to_uid,
    text: row.text,
    createdAt: row.created_at,
    read: row.read,
    readAt: row.read_at ?? undefined,
  };
}

/** `notifications` row (snake_case, matches the Supabase table). */
export interface NotificationRow {
  id: string;
  user_id: string;
  type: LocalNotification['type'];
  title: string;
  body: string;
  post_id: string | null;
  read: boolean;
  created_at: string;
  actor_id?: string | null;
  target_type?: LocalNotification['targetType'] | null;
  target_id?: string | null;
  read_at?: string | null;
}

export function rowToNotification(row: NotificationRow): LocalNotification {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    postId: row.post_id ?? undefined,
    actorId: row.actor_id ?? undefined,
    targetType: row.target_type ?? undefined,
    targetId: row.target_id ?? undefined,
    createdAt: row.created_at,
    read: row.read,
    readAt: row.read_at ?? undefined,
  };
}

export function notificationToRow(
  notification: LocalNotification,
  userId: string,
): Omit<NotificationRow, 'id'> {
  return {
    user_id: userId,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    post_id: notification.postId ?? null,
    read: notification.read,
    created_at: notification.createdAt,
    actor_id: notification.actorId ?? null,
    target_type: notification.targetType ?? null,
    target_id: notification.targetId ?? null,
    read_at: notification.readAt ?? null,
  };
}
