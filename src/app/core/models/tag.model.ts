export interface Tag {
  id?: string;
  username: string;
  userId: string;
  highlight: string;
  lat: number;
  lng: number;
  expiresIn: number;
  tag: string;
  createdAt: string;
  images: string[];
  hoodId?: string;
  country?: string;
  loves?: number;
  dislikes?: number;
  comments?: string[];
  eventStart?: string;
  eventEnd?: string;
  pollOptions?: string[];
  pollVotes?: Record<string, string[]>; // optionIndex -> array of usernames
  /** Trigger-maintained aggregate counts - never write these from the client. */
  likeCount?: number;
  commentCount?: number;
  rsvpCount?: number;
  currentStatus?: PostStatus;
  statusUpdatedAt?: string;
  verificationCount?: number;
}

export type PostStatus = 'active' | 'resolved' | 'cancelled' | 'closed';

export interface ThreadedComment {
  id: string;
  postId: string;
  author: string;
  authorUid: string;
  text: string;
  createdAt: string;
  upvotes: number;
  mentions: string[];
  parentId?: string;
  updatedAt?: string;
  deletedAt?: string;
}

export interface DirectMessage {
  id: string;
  threadId: string;
  postId: string;
  from: string;
  to: string;
  fromUid: string;
  toUid: string;
  text: string;
  createdAt: string;
  read: boolean;
  readAt?: string;
}

export interface LocalNotification {
  id: string;
  type: 'reply' | 'mention' | 'love' | 'follow' | 'alert' | 'rsvp' | 'message' | 'verification' | 'status';
  title: string;
  body: string;
  postId?: string;
  actorId?: string;
  targetType?: 'post' | 'comment' | 'user' | 'thread';
  targetId?: string;
  createdAt: string;
  read: boolean;
  readAt?: string;
}

export interface HoodMessage {
  id?: string;
  hoodId: string;
  userId: string;
  username: string;
  text: string;
  createdAt: string;
}
