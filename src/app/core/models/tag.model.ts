export interface Tag {
  id?: string;
  username: string;
  /** Snapshot of the poster's shop/business name at post time — set only for business accounts. */
  businessName?: string;
  /** Snapshot of optional business contact info at post time — set only for business accounts. */
  businessPhone?: string;
  businessWebsite?: string;
  /** How the post was composed. Business posts may be created by any account type. */
  postType?: 'personal' | 'business';
  /** Lightweight business intent — simpler than the tag category, shown as the headline chip. */
  intent?: PostIntent;
  price?: number;
  /** Shown struck through next to `price` when set (discount display). */
  originalPrice?: number;
  /** Free text — "3 slots left", "Fully booked", etc. */
  availabilityNote?: string;
  cta?: PostCta;
  /** External or internal product/service page. */
  productLink?: string;
  userId: string;
  highlight: string;
  lat: number;
  lng: number;
  expiresIn: number;
  tag: string;
  createdAt: string;
  images: string[];
  hoodId?: string;
  /** Admin-1 region (e.g. "Kerala"). Populated from Nominatim at post time. */
  state?: string;
  country?: string;
  locationType?: 'pinpoint' | 'place';
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

export type PostIntent =
  | 'offer'
  | 'available_now'
  | 'open_slot'
  | 'happening'
  | 'looking_for'
  | 'sell_give';

export type PostCta =
  | 'message'
  | 'call'
  | 'whatsapp'
  | 'directions'
  | 'visit_shop'
  | 'view_product'
  | 'book'
  | 'join'
  | 'interested';

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
  type:
    | 'reply'
    | 'mention'
    | 'love'
    | 'follow'
    | 'alert'
    | 'rsvp'
    | 'message'
    | 'verification'
    | 'status';
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
