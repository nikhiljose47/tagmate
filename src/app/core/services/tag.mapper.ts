import { PostCta, PostIntent, Tag } from '../models/tag.model';

/** Database row shape (snake_case) that matches the Supabase `tags` table. */
export interface TagRow {
  id?: string;
  username: string;
  business_name?: string | null;
  business_phone?: string | null;
  business_website?: string | null;
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
  poll_options?: string[];
  poll_votes?: Record<string, string[]>;
  like_count?: number;
  comment_count?: number;
  rsvp_count?: number;
  current_status?: 'active' | 'resolved' | 'cancelled' | 'closed';
  status_updated_at?: string | null;
  verification_count?: number;
}

/** Converts a domain Tag into a Supabase row for insert/update. */
export function tagToRow(tag: Tag): Omit<TagRow, 'id'> {
  return {
    username: tag.username,
    business_name: tag.businessName ?? null,
    business_phone: tag.businessPhone ?? null,
    business_website: tag.businessWebsite ?? null,
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
    poll_options: tag.pollOptions,
    poll_votes: tag.pollVotes,
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
    pollOptions: row.poll_options,
    pollVotes: row.poll_votes,
    likeCount: row.like_count,
    commentCount: row.comment_count,
    rsvpCount: row.rsvp_count,
    currentStatus: row.current_status ?? 'active',
    statusUpdatedAt: row.status_updated_at ?? undefined,
    verificationCount: row.verification_count ?? 0,
  };
}
