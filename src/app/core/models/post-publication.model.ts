import { PublicationDestination, PublicationStatus } from '../enums/integration.enum';

/**
 * Per-post, per-destination publish status — e.g. a post can be
 * `PUBLISHED` on `website` and `FAILED` on `instagram` at the same time.
 * Rows are created/updated by the backend only (see the business-integrations
 * migration); the frontend only ever reads them, never writes.
 */
export interface PostPublication {
  id: string;
  postId: string;
  provider: PublicationDestination;
  status: PublicationStatus;
  providerPostId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
