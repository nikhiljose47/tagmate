export interface Tag {
  id?: string;
  username: string;
  /** Snapshot of the poster's shop/business name at post time — set only for business accounts. */
  businessName?: string;
  /** Snapshot of optional business contact info at post time — set only for business accounts. */
  businessPhone?: string;
  businessWebsite?: string;
  /** Snapshot of the poster's public WhatsApp click-to-chat link (`AppUser.socialWhatsapp`)
   *  at post time. Preferred over `businessPhone` for the `whatsapp` CTA — see
   *  business-post-content.component.ts's `ctaHref`. */
  businessWhatsapp?: string;
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
  /** Personal-post card background — a preset hex swatch, e.g. "#fef3c7". Unset = default. */
  backgroundColor?: string;
  /** Template metadata — set for business posts created after the Step 1 migration.
   *  Null/undefined on old posts; those continue to render from `highlight` alone. */
  /** The specific template variant used, e.g. "general", "todays_special". */
  postSubtype?: string;
  /** Monotonic template version; > 0 when set. */
  templateVersion?: number;
  /** Optional structured post title (separate from the composed highlight). */
  title?: string;
  /** Raw key/value pairs from the quick-fill form — stored for audit/display. */
  templateData?: Record<string, unknown>;
  /** Trigger-maintained aggregate counts - never write these from the client. */
  likeCount?: number;
  commentCount?: number;
  rsvpCount?: number;
  currentStatus?: PostStatus;
  statusUpdatedAt?: string;
  verificationCount?: number;
  /** Publishing state — separate from currentStatus's active/resolved/cancelled/closed
   *  lifecycle. Undefined on legacy rows behaves the same as 'published'. Step 5.A. */
  publishStatus?: PublishStatus;
  /** Set once the post actually becomes public (Publish Now, or cron for a scheduled post).
   *  `null` explicitly clears it on update (e.g. moving a scheduled post back to draft);
   *  `undefined` means "leave unchanged" — same tri-state convention as scheduledFor. */
  publishedAt?: string | null;
  /** When a scheduled post should go live — independent of business-content dates
   *  like eventStart/eventEnd. Only meaningful while publishStatus === 'scheduled'.
   *  `null` explicitly clears it on update; `undefined` means "leave unchanged". */
  scheduledFor?: string | null;
  /** Touched on every author edit. */
  updatedAt?: string;
}

export type PostStatus = 'active' | 'resolved' | 'cancelled' | 'closed';
export type PublishStatus = 'draft' | 'scheduled' | 'published';

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
