import { Tag } from '../models/tag.model';

/** Database row shape (snake_case) that matches the Supabase `tags` table. */
export interface TagRow {
  id?: string;
  username: string;
  user_id: string;
  highlight: string;
  lat: number;
  lng: number;
  expires_in: number;
  tag: string;
  created_at: string;
  images: string[];
  hood_id?: string;
  country?: string;
}

/** Converts a domain Tag into a Supabase row for insert/update. */
export function tagToRow(tag: Tag): Omit<TagRow, 'id'> {
  return {
    username:   tag.username,
    user_id:    tag.userId,
    highlight:  tag.highlight,
    lat:        tag.lat,
    lng:        tag.lng,
    expires_in: tag.expiresIn,
    tag:        tag.tag,
    created_at: tag.createdAt,
    images:     tag.images,
    hood_id:    tag.hoodId,
    country:    tag.country,
  };
}

/** Converts a Supabase row into a domain Tag. */
export function rowToTag(row: TagRow): Tag {
  return {
    id:        row.id,
    username:  row.username,
    userId:    row.user_id,
    highlight: row.highlight,
    lat:       row.lat,
    lng:       row.lng,
    expiresIn: row.expires_in,
    tag:       row.tag,
    createdAt: row.created_at,
    images:    row.images,
    hoodId:    row.hood_id,
    country:   row.country,
  };
}
