import { DirectMessage, LocalNotification, ThreadedComment } from '../models/tag.model';

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
