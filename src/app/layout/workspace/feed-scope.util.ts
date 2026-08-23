import { Tag } from '../../core/models/tag.model';
import { FeedBetaMainCategory } from './workspace-state.service';

/**
 * Centralized tag → feed-scope mapping (Step 4.B) — replaces the hardcoded
 * switch/if chain that used to live as a private method on FeedBetaPage.
 *
 * Every current business category (and legacy personal category) has an
 * explicit entry — nothing falls through silently. Adding a new category
 * later means adding one line here, not touching feed component logic.
 */
export const FEED_SCOPE_BY_TAG: Readonly<Record<string, FeedBetaMainCategory>> = {
  'hot-now': 'hot-now',
  dating: 'dating',

  game: 'game',
  fitness: 'game',

  // Legacy personal 'job' posts and the three business categories whose
  // *parent* tag itself reads as job-like content.
  job: 'job',
  biz: 'job',
  service: 'job',
  auto: 'job',

  around: 'around',
  help: 'around',
  notice: 'around',
  bulletin: 'around',
  alert: 'around',
  poll: 'around',
  shop: 'around',
  food: 'around',
  beauty: 'around',
  health: 'around',
  learn: 'around',
  space: 'around',
  travel: 'around',
  event: 'around',
};

/**
 * Business post_subtype ids that surface a post into the Job feed scope
 * regardless of parent category — e.g. a Food business's "We're Hiring"
 * post (tag=food, postSubtype=job) still belongs in Job discovery.
 *
 * The stored parent tag is never changed by this — it only affects which
 * feed scope the post is grouped under.
 */
const JOB_SUBTYPES = new Set(['job']);

/**
 * Resolves a post's feed scope from both its parent category (`tag`) and,
 * where relevant, its `postSubtype`. Subtype only ever narrows/redirects
 * discovery — it never changes `post.tag` itself.
 */
export function resolveFeedScope(
  post: Pick<Tag, 'tag' | 'postSubtype'>,
): FeedBetaMainCategory | null {
  if (post.postSubtype && JOB_SUBTYPES.has(post.postSubtype)) return 'job';
  const tag = post.tag?.trim().toLowerCase();
  return tag ? (FEED_SCOPE_BY_TAG[tag] ?? null) : null;
}
