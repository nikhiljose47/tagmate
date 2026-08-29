import { PostCta, PostIntent, PublishStatus, Tag } from '../models/tag.model';

/** Database row shape (snake_case) that matches the Supabase `tags` table. */
export interface TagRow {
  id?: string;
  username: string;
  business_name?: string | null;
  business_phone?: string | null;
  business_website?: string | null;
  business_whatsapp?: string | null;
  post_type?: 'personal' | 'business' | null;
  intent?: string | null;
  price?: number | null;
  original_price?: number | null;
  availability_note?: string | null;
  cta?: string | null;
  product_link?: string | null;
  user_id: string;
  highlight: string;
  lat: number;
  lng: number;
  expires_in: number;
  tag: string;
  created_at: string;
  images: string[];
  hood_id?: string;
  state?: string;
  country?: string;
  location_type?: 'pinpoint' | 'place';
  loves?: number;
  dislikes?: number;
  comments?: string[];
  event_start?: string | null;
  event_end?: string | null;
  poll_options?: string[];
  poll_votes?: Record<string, string[]>;
  background_color?: string | null;
  like_count?: number;
  comment_count?: number;
  rsvp_count?: number;
  current_status?: 'active' | 'resolved' | 'cancelled' | 'closed';
  status_updated_at?: string | null;
  verification_count?: number;
  // Step 1 template fields — null on old rows, safe to omit on reads.
  post_subtype?: string | null;
  template_version?: number | null;
  title?: string | null;
  template_data?: Record<string, unknown> | null;
  // Step 5.A publishing state — defaults to 'published' in the DB, so undefined here
  // (old rows read before this migration) behaves the same as 'published'.
  publish_status?: string | null;
  published_at?: string | null;
  scheduled_for?: string | null;
  updated_at?: string | null;
}

/** Converts a domain Tag into a Supabase row for insert/update. */
export function tagToRow(tag: Tag): Omit<TagRow, 'id'> {
  return {
    username: tag.username,
    business_name: tag.businessName ?? null,
    business_phone: tag.businessPhone ?? null,
    business_website: tag.businessWebsite ?? null,
    business_whatsapp: tag.businessWhatsapp ?? null,
    post_type: tag.postType ?? 'personal',
    intent: tag.intent ?? null,
    price: tag.price ?? null,
    original_price: tag.originalPrice ?? null,
    availability_note: tag.availabilityNote ?? null,
    cta: tag.cta ?? null,
    product_link: tag.productLink ?? null,
    user_id: tag.userId,
    highlight: tag.highlight,
    lat: tag.lat,
    lng: tag.lng,
    expires_in: tag.expiresIn,
    tag: tag.tag,
    created_at: tag.createdAt,
    images: tag.images,
    hood_id: tag.hoodId,
    state: tag.state,
    country: tag.country,
    location_type: tag.locationType,
    loves: tag.loves,
    dislikes: tag.dislikes,
    comments: tag.comments,
    event_start: tag.eventStart ?? null,
    event_end: tag.eventEnd ?? null,
    poll_options: tag.pollOptions,
    poll_votes: tag.pollVotes,
    background_color: tag.backgroundColor ?? null,
    // Step 1 template fields
    title: tag.title ?? null,
    post_subtype: tag.postSubtype ?? null,
    template_version: tag.templateVersion ?? null,
    template_data: tag.templateData ?? null,
    // Step 5.A publishing state
    ...(tag.publishStatus !== undefined ? { publish_status: tag.publishStatus } : {}),
    ...(tag.publishedAt !== undefined ? { published_at: tag.publishedAt ?? null } : {}),
    ...(tag.scheduledFor !== undefined ? { scheduled_for: tag.scheduledFor ?? null } : {}),
  };
}

/** Converts a Supabase row into a domain Tag. */
export function rowToTag(row: TagRow): Tag {
  return {
    id: row.id,
    username: row.username,
    businessName: row.business_name ?? undefined,
    businessPhone: row.business_phone ?? undefined,
    businessWebsite: row.business_website ?? undefined,
    businessWhatsapp: row.business_whatsapp ?? undefined,
    postType: row.post_type === 'business' ? 'business' : 'personal',
    intent: (row.intent as PostIntent) ?? undefined,
    price: row.price ?? undefined,
    originalPrice: row.original_price ?? undefined,
    availabilityNote: row.availability_note ?? undefined,
    cta: (row.cta as PostCta) ?? undefined,
    productLink: row.product_link ?? undefined,
    userId: row.user_id,
    highlight: row.highlight,
    lat: row.lat,
    lng: row.lng,
    expiresIn: row.expires_in,
    tag: row.tag,
    createdAt: row.created_at,
    images: row.images,
    hoodId: row.hood_id,
    state: row.state,
    country: row.country,
    locationType: row.location_type,
    loves: row.loves,
    dislikes: row.dislikes,
    comments: row.comments,
    eventStart: row.event_start ?? undefined,
    eventEnd: row.event_end ?? undefined,
    pollOptions: row.poll_options,
    pollVotes: row.poll_votes,
    backgroundColor: row.background_color ?? undefined,
    likeCount: row.like_count,
    commentCount: row.comment_count,
    rsvpCount: row.rsvp_count,
    currentStatus: row.current_status ?? 'active',
    statusUpdatedAt: row.status_updated_at ?? undefined,
    verificationCount: row.verification_count ?? 0,
    // Step 1 template fields — undefined on old rows, never throws
    title: row.title ?? undefined,
    postSubtype: row.post_subtype ?? undefined,
    templateVersion: row.template_version ?? undefined,
    templateData: row.template_data ?? undefined,
    // Step 5.A publishing state — undefined behaves the same as 'published'.
    publishStatus: (row.publish_status as PublishStatus) ?? undefined,
    publishedAt: row.published_at ?? undefined,
    scheduledFor: row.scheduled_for ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  };
}
