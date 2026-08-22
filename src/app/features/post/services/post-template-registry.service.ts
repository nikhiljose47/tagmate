import { Injectable } from '@angular/core';
import { TagCategory } from '../../../core/enums/tag-category.enum';
import { PostTemplateDefinition, POST_TEMPLATE_REGISTRY } from '../data/post-template-registry';

/**
 * Resolves business post templates from the central registry — the single
 * source of truth for template metadata (label, icon, ordering, recommended,
 * defaults, version) across the whole app.
 *
 * Pure utility — no Supabase dependency. Templates remain frontend config
 * (Step 1); Step 5.B does not move them into a database-driven CMS.
 *
 * `enabled` only affects *selection* for new posts — it must never block
 * *resolution* of a historical post's template, or an old post using a
 * since-disabled template would silently lose its subtype-aware rendering.
 * That's why there are two lookup methods:
 *   - getTemplate()       — new-post selection; null if disabled.
 *   - resolveForDisplay() — rendering an existing post; ignores `enabled`.
 *
 * Version-bump policy (Step 5.B): bump a template's `version` only when the
 * *stored data interpretation* changes incompatibly (a field is removed,
 * repurposed, or its meaning changes). Do NOT bump it for cosmetic changes —
 * label wording, icon, shortDescription, displayOrder, recommended — none of
 * those can break a historical post's templateData. Only one historical
 * version exists per template today; resolveForDisplay accepts an optional
 * `version` so a template that later needs multiple historical definitions
 * has somewhere to plug in without changing any call site.
 *
 * API:
 *   getTemplatesForCategory(category)              — all enabled templates, sorted by displayOrder
 *   getRecommendedTemplates(category)               — enabled templates with recommended: true, sorted by displayOrder
 *   getTemplate(category, templateId)                — exact lookup for selection; null if not found / disabled
 *   resolveForDisplay(category, templateId, version) — exact lookup for rendering; ignores `enabled`
 *   getDefaultTemplate(category)                    — first recommended, or first enabled; null if none
 */
@Injectable({ providedIn: 'root' })
export class PostTemplateRegistryService {
  /** All enabled templates for a category, sorted by displayOrder ascending. */
  getTemplatesForCategory(category: TagCategory | string): PostTemplateDefinition[] {
    const all = POST_TEMPLATE_REGISTRY[category as TagCategory] ?? [];
    return [...all]
      .filter((t) => t.enabled !== false)
      .sort((a, b) => (a.displayOrder ?? 999) - (b.displayOrder ?? 999));
  }

  /** Enabled templates marked as recommended, sorted by displayOrder — the
   *  registry stays authoritative here; nothing hardcodes a recommended list. */
  getRecommendedTemplates(category: TagCategory | string): PostTemplateDefinition[] {
    return this.getTemplatesForCategory(category).filter((t) => t.recommended);
  }

  /** Exact lookup for NEW post creation/selection. Returns null if not found or disabled. */
  getTemplate(category: TagCategory | string, templateId: string): PostTemplateDefinition | null {
    const found = this.findRaw(category, templateId);
    if (!found || found.enabled === false) return null;
    return found;
  }

  /**
   * Resolves a template for RENDERING an existing post — used by every
   * subtype-aware display path (FeedBeta/PostDetail/Profile) and by resuming
   * a draft for editing. Ignores `enabled` so disabled templates still
   * render their historical posts correctly (Step 5.B item 3/8).
   *
   * `version` is accepted for forward compatibility with a future template
   * that has multiple historical definitions; only one version exists per
   * template today, so it's currently unused beyond documenting the intent
   * — see the version-bump policy in the class doc above. Returns null (not
   * a thrown error) when the subtype is missing or was never a real id, so
   * callers can fall back to generic rendering per the resolver order in
   * Step 5.B item 22.
   */
  resolveForDisplay(
    category: TagCategory | string,
    templateId: string | undefined | null,
    _version?: number,
  ): PostTemplateDefinition | null {
    if (!templateId) return null;
    return this.findRaw(category, templateId);
  }

  /**
   * Best single template for a category:
   *   1. First recommended (by displayOrder)
   *   2. First enabled (by displayOrder)
   *   3. null — category has no templates
   */
  getDefaultTemplate(category: TagCategory | string): PostTemplateDefinition | null {
    const enabled = this.getTemplatesForCategory(category);
    if (!enabled.length) return null;
    return enabled.find((t) => t.recommended) ?? enabled[0] ?? null;
  }

  /** True when a category has at least one enabled template. */
  hasTemplates(category: TagCategory | string): boolean {
    return this.getTemplatesForCategory(category).length > 0;
  }

  private findRaw(
    category: TagCategory | string,
    templateId: string,
  ): PostTemplateDefinition | null {
    const all = POST_TEMPLATE_REGISTRY[category as TagCategory] ?? [];
    return all.find((t) => t.id === templateId) ?? null;
  }
}
