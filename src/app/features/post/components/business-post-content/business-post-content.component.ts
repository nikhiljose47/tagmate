import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Tag, PostCta } from '../../../../core/models/tag.model';
import { TagPillComponent } from '../../../../shared/components/tag-pill/tag-pill.component';
import { PostTemplateRegistryService } from '../../services/post-template-registry.service';
import { PostTemplateDefinition, TemplateField } from '../../data/post-template-registry';

const CTA_LABELS: Record<PostCta, string> = {
  message: 'Message',
  call: 'Call',
  whatsapp: 'WhatsApp',
  directions: 'Directions',
  visit_shop: 'Visit shop',
  view_product: 'View product',
  book: 'Book',
  join: 'Join',
  interested: 'Interested',
};

const CTA_ICONS: Record<PostCta, string> = {
  message: 'bi-chat-dots-fill',
  call: 'bi-telephone-fill',
  whatsapp: 'bi-whatsapp',
  directions: 'bi-signpost-2-fill',
  visit_shop: 'bi-shop',
  view_product: 'bi-bag-fill',
  book: 'bi-calendar-check-fill',
  join: 'bi-people-fill',
  interested: 'bi-hand-thumbs-up-fill',
};

/**
 * Resolves the `whatsapp` CTA's destination. Prefers the business's public
 * WhatsApp click-to-chat link (`businessWhatsapp`, snapshotted from
 * `AppUser.socialWhatsapp` — see post.ts), since that's the destination the
 * business actually chose to publish. `businessPhone` is a backwards-compatible
 * fallback for posts made before this field existed, or businesses that never
 * set `socialWhatsapp` — without it, their WhatsApp CTA would silently stop
 * working. This is independent of whether the WhatsApp Business API
 * integration (`BusinessIntegration`) is connected — that's a separate,
 * server-side authorization concept, not a public link. Exported for testing.
 */
export function resolveWhatsappHref(
  businessWhatsapp?: string,
  businessPhone?: string,
): string | null {
  const link = businessWhatsapp?.trim();
  if (link) {
    return /^https?:\/\//i.test(link) ? link : `https://wa.me/${link.replace(/\D/g, '')}`;
  }
  return businessPhone ? `https://wa.me/${businessPhone.replace(/\D/g, '')}` : null;
}

/**
 * Friendly formatter for eventStart/eventEnd — never exposes raw ISO strings.
 * Exported so post-detail's existing RSVP/event box can reuse the exact same
 * formatting instead of a second copy.
 */
export function formatEventRange(eventStart?: string, eventEnd?: string): string {
  const fmtDayTime = (iso: string): string => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const day = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
    const time = d.toLocaleTimeString('en-IN', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    return `${day} • ${time}`;
  };
  const fmtTime = (iso: string): string => {
    const d = new Date(iso);
    return isNaN(d.getTime())
      ? ''
      : d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  if (eventStart && eventEnd) {
    const s = new Date(eventStart);
    const e = new Date(eventEnd);
    if (!isNaN(s.getTime()) && !isNaN(e.getTime())) {
      const sameDay = s.toDateString() === e.toDateString();
      if (sameDay) {
        const dayLabel = s.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        return `${dayLabel}, ${fmtTime(eventStart)} – ${fmtTime(eventEnd)}`;
      }
      return `${fmtDayTime(eventStart)} – ${fmtDayTime(eventEnd)}`;
    }
  }
  if (eventStart) return fmtDayTime(eventStart);
  if (eventEnd) return `Until ${fmtDayTime(eventEnd)}`;
  return '';
}

interface StructuredValue {
  readonly key: string;
  readonly text: string;
}

/**
 * Renders the subtype-aware content block for a business post: category +
 * subtype pill, structured title, body, template-driven structured values,
 * price row, event range, and CTA.
 *
 * Resolves `post.tag` + `post.postSubtype` through the existing template
 * registry — never duplicates subtype labels. Falls back to plain
 * highlight-only rendering when the subtype is missing/unknown (legacy
 * posts), so it's safe to use unconditionally on every business post.
 */
@Component({
  selector: 'app-business-post-content',
  standalone: true,
  imports: [CommonModule, RouterLink, TagPillComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './business-post-content.component.html',
  styleUrl: './business-post-content.component.scss',
})
export class BusinessPostContentComponent {
  private readonly registry = inject(PostTemplateRegistryService);

  readonly post = input.required<Tag>();
  /** 'detail' allows a bit more room than the compact feed/profile card. */
  readonly variant = input<'feed' | 'detail' | 'profile'>('feed');
  /** The detail page's own event/RSVP box already shows the date — skip the duplicate line there. */
  readonly showEventRange = input(true);
  /** Hide the customer-facing CTA when viewing your own post (profile). */
  readonly showCta = input(true);
  /** Route to fall back to when the CTA has no direct external link (message/book/join/interested). */
  readonly fallbackLink = input<readonly unknown[] | null>(null);

  readonly resolvedTemplate = computed<PostTemplateDefinition | null>(() => {
    const p = this.post();
    // resolveForDisplay (not getTemplate) — rendering a historical post must
    // not be affected by the template having since been disabled (Step 5.B).
    return this.registry.resolveForDisplay(p.tag, p.postSubtype, p.templateVersion);
  });

  readonly subtypeIcon = computed(() => this.resolvedTemplate()?.icon || '📝');
  readonly subtypeLabel = computed(() => this.resolvedTemplate()?.label ?? '');

  readonly displayTitle = computed(() => this.post().title?.trim() || '');

  readonly eventRangeText = computed(() =>
    this.showEventRange() ? formatEventRange(this.post().eventStart, this.post().eventEnd) : '',
  );

  readonly hasPriceRow = computed(
    () => !!this.post().price || !!this.post().originalPrice || !!this.post().availabilityNote,
  );

  /** Non-universal template fields (no `mapsTo`) with a real value in templateData
   *  — the "important structured values" the template's author chose to collect. */
  readonly structuredValues = computed<StructuredValue[]>(() => {
    const template = this.resolvedTemplate();
    const data = this.post().templateData;
    if (!template || !data) return [];
    const out: StructuredValue[] = [];
    for (const field of template.fields) {
      if (field.mapsTo) continue; // already surfaced as a universal Tag field below
      const raw = data[field.key];
      if (raw === undefined || raw === null || raw === '') continue;
      const text = this.formatFieldValue(field, raw);
      if (text) out.push({ key: field.key, text });
    }
    return out;
  });

  private formatFieldValue(field: TemplateField, raw: unknown): string {
    const value = String(raw);
    switch (field.type) {
      case 'toggle':
        return value === 'true' ? field.shortLabel || field.label : '';
      case 'multi-select':
        return value.split(',').filter(Boolean).join(', ');
      case 'date': {
        const d = new Date(value);
        return isNaN(d.getTime())
          ? value
          : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
      }
      case 'datetime': {
        const formatted = formatEventRange(value);
        return formatted || value;
      }
      case 'price':
        return `₹${value}`;
      default:
        return value;
    }
  }

  readonly cta = computed(() => this.post().cta);
  readonly ctaLabel = computed(() => (this.cta() ? CTA_LABELS[this.cta()!] : ''));
  readonly ctaIcon = computed(() => (this.cta() ? CTA_ICONS[this.cta()!] : ''));

  /** Mirrors the CTA destination rules previously implemented only in FeedBeta. */
  readonly ctaHref = computed<string | null>(() => {
    const p = this.post();
    switch (p.cta) {
      case 'call':
        return p.businessPhone ? `tel:${p.businessPhone}` : null;
      case 'whatsapp':
        return resolveWhatsappHref(p.businessWhatsapp, p.businessPhone);
      case 'directions':
        return Number.isFinite(p.lat) && Number.isFinite(p.lng)
          ? `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`
          : null;
      case 'visit_shop':
        return p.businessWebsite || null;
      case 'view_product':
        return p.productLink || p.businessWebsite || null;
      default:
        return null;
    }
  });
}
