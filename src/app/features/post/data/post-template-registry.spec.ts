import { TagCategory } from '../../../core/enums/tag-category.enum';
import {
  POST_TEMPLATE_REGISTRY,
  PostTemplateDefinition,
  TemplateField,
  emptyTemplateValues,
  isTemplateComplete,
  has,
  joinParts,
  fmtPrice,
  fmtPriceRange,
  presets,
  priceGroup,
  eventGroup,
  appointmentGroup,
  mapTemplateValues,
  sanitiseTemplateData,
  restoreTemplateValues,
  resolveTemplateDefaults,
  resolveExpiry,
} from './post-template-registry';
import { validateTemplateValues } from './post-template-validation';

const BUSINESS_CATEGORIES: TagCategory[] = [
  TagCategory.Shop,
  TagCategory.Food,
  TagCategory.Service,
  TagCategory.Beauty,
  TagCategory.Health,
  TagCategory.Fitness,
  TagCategory.Learn,
  TagCategory.Auto,
  TagCategory.Space,
  TagCategory.Travel,
  TagCategory.Event,
  TagCategory.Biz,
];

describe('PostTemplateRegistry — Step 2.A', () => {
  // ─── Registry integrity ──────────────────────────────────────────────────

  it('has templates for all 12 business categories', () => {
    for (const cat of BUSINESS_CATEGORIES) {
      const templates = POST_TEMPLATE_REGISTRY[cat];
      expect(templates).toBeTruthy(`Missing templates for category ${cat}`);
      expect(templates!.length).toBeGreaterThan(0, `Empty array for ${cat}`);
    }
  });

  it('has no duplicate subtype IDs within any category', () => {
    for (const [cat, templates] of Object.entries(POST_TEMPLATE_REGISTRY)) {
      if (!templates) continue;
      const ids = templates.map((t) => t.id);
      const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
      expect(dupes.length).toBe(0, `Duplicate IDs in ${cat}: ${dupes.join(', ')}`);
    }
  });

  it('every template has label, version >= 1, fields, and buildHighlight', () => {
    for (const [cat, templates] of Object.entries(POST_TEMPLATE_REGISTRY)) {
      if (!templates) continue;
      for (const t of templates) {
        expect(t.label).toBeTruthy(`${cat}/${t.id} missing label`);
        expect(t.version).toBeGreaterThanOrEqual(1, `${cat}/${t.id} version < 1`);
        expect(t.fields).toBeTruthy(`${cat}/${t.id} missing fields`);
        expect(typeof t.buildHighlight).toBe('function', `${cat}/${t.id} missing buildHighlight`);
      }
    }
  });

  it('category matches the registered key for every template', () => {
    for (const [cat, templates] of Object.entries(POST_TEMPLATE_REGISTRY)) {
      if (!templates) continue;
      for (const t of templates) {
        expect(t.category).toBe(cat as TagCategory, `${t.id} category mismatch`);
      }
    }
  });

  // ─── Legacy compatibility ────────────────────────────────────────────────

  it('legacy "general" templates remain resolvable (enabled=false)', () => {
    for (const cat of BUSINESS_CATEGORIES) {
      const templates = POST_TEMPLATE_REGISTRY[cat]!;
      const general = templates.find((t) => t.id === 'general');
      expect(general).toBeTruthy(`${cat} missing "general" legacy template`);
      expect(general!.enabled).toBe(false, `${cat}/general should be disabled`);
    }
  });

  // ─── TemplateField types ─────────────────────────────────────────────────

  it('presets produce fields with correct types and mapsTo', () => {
    const p = presets.price();
    expect(p.type).toBe('price');
    expect(p.mapsTo).toBe('price');

    const op = presets.originalPrice();
    expect(op.mapsTo).toBe('originalPrice');

    const es = presets.eventStart();
    expect(es.type).toBe('datetime');
    expect(es.mapsTo).toBe('eventStart');

    const pl = presets.productLink();
    expect(pl.type).toBe('url');
    expect(pl.mapsTo).toBe('productLink');

    const ph = presets.phone();
    expect(ph.type).toBe('phone');

    const desc = presets.description();
    expect(desc.type).toBe('textarea');
    expect(desc.mapsTo).toBeUndefined();
  });

  it('presets can be overridden', () => {
    const p = presets.price({ label: 'Fee', placeholder: 'e.g. 500' });
    expect(p.label).toBe('Fee');
    expect(p.placeholder).toBe('e.g. 500');
    expect(p.mapsTo).toBe('price'); // inherited
  });

  it('priceGroup returns price + originalPrice pair', () => {
    const [p, o] = priceGroup();
    expect(p.key).toBe('price');
    expect(o.key).toBe('originalPrice');
  });

  it('eventGroup returns eventStart + eventEnd pair', () => {
    const [s, e] = eventGroup();
    expect(s.mapsTo).toBe('eventStart');
    expect(e.mapsTo).toBe('eventEnd');
  });

  it('appointmentGroup returns date + time (no mapsTo)', () => {
    const [d, t] = appointmentGroup();
    expect(d.type).toBe('date');
    expect(t.type).toBe('time');
    expect(d.mapsTo).toBeUndefined();
    expect(t.mapsTo).toBeUndefined();
  });

  // ─── Highlight / title helpers ───────────────────────────────────────────

  it('has() detects present non-blank values', () => {
    expect(has({ a: 'hello' }, 'a')).toBeTrue();
    expect(has({ a: '' }, 'a')).toBeFalse();
    expect(has({ a: '  ' }, 'a')).toBeFalse();
    expect(has({}, 'a')).toBeFalse();
  });

  it('joinParts filters blanks and joins with separator', () => {
    expect(joinParts(['a', '', undefined, 'b', false])).toBe('a • b');
    expect(joinParts(['a', 'b'], ' — ')).toBe('a — b');
    expect(joinParts([undefined, '', false])).toBe('');
  });

  it('fmtPrice formats numbers with ₹', () => {
    expect(fmtPrice('199')).toBe('₹199');
    expect(fmtPrice('')).toBe('');
    expect(fmtPrice(undefined)).toBe('');
    expect(fmtPrice('free')).toBe('free');
  });

  it('fmtPriceRange shows discount notation', () => {
    expect(fmtPriceRange('199', '299')).toBe('₹199 (was ₹299)');
    expect(fmtPriceRange('199', '')).toBe('₹199');
    expect(fmtPriceRange('', '299')).toBe('₹299');
    expect(fmtPriceRange('', '')).toBe('');
    expect(fmtPriceRange('199', '199')).toBe('₹199');
  });

  // ─── emptyTemplateValues / isTemplateComplete ────────────────────────────

  it('emptyTemplateValues uses defaultValue when provided', () => {
    const tpl = {
      fields: [
        { key: 'a', type: 'text' as const, label: 'A' },
        { key: 'b', type: 'toggle' as const, label: 'B', defaultValue: 'true' },
      ],
    };
    const vals = emptyTemplateValues(tpl);
    expect(vals['a']).toBe('');
    expect(vals['b']).toBe('true');
  });

  it('isTemplateComplete checks required fields', () => {
    const tpl = {
      fields: [
        { key: 'a', type: 'text' as const, label: 'A', required: true },
        { key: 'b', type: 'text' as const, label: 'B' },
      ],
    };
    expect(isTemplateComplete(tpl, { a: '', b: '' })).toBeFalse();
    expect(isTemplateComplete(tpl, { a: 'ok', b: '' })).toBeTrue();
  });

  // ─── Value mapping ───────────────────────────────────────────────────────

  it('mapTemplateValues splits universal vs templateData', () => {
    const tpl: Pick<PostTemplateDefinition, 'fields'> = {
      fields: [
        presets.price(),
        presets.originalPrice(),
        presets.productLink(),
        { key: 'brand', type: 'text', label: 'Brand' }, // no mapsTo
        { key: 'stock', type: 'number', label: 'Stock' },
      ],
    };
    const values = {
      price: '199',
      originalPrice: '299',
      productLink: 'https://example.com',
      brand: 'Acme',
      stock: '10',
    };
    const result = mapTemplateValues(tpl, values);
    expect(result.tagFields['price']).toBe('199');
    expect(result.tagFields['originalPrice']).toBe('299');
    expect(result.tagFields['productLink']).toBe('https://example.com');
    expect(result.templateData['brand']).toBe('Acme');
    expect(result.templateData['stock']).toBe('10');
    // Universal fields should NOT appear in templateData
    expect(result.templateData['price']).toBeUndefined();
    expect(result.templateData['originalPrice']).toBeUndefined();
  });

  it('mapTemplateValues omits blank values', () => {
    const tpl = {
      fields: [presets.price(), { key: 'brand', type: 'text' as const, label: 'Brand' }],
    };
    const result = mapTemplateValues(tpl, { price: '', brand: '' });
    expect(Object.keys(result.tagFields).length).toBe(0);
    expect(Object.keys(result.templateData).length).toBe(0);
  });

  // ─── Sanitise ────────────────────────────────────────────────────────────

  it('sanitiseTemplateData removes unknown keys and non-serialisable values', () => {
    const tpl = {
      fields: [
        { key: 'brand', type: 'text' as const, label: 'Brand' },
        presets.price(), // has mapsTo, so excluded from templateData
      ],
    };
    const data: Record<string, unknown> = {
      brand: 'Acme',
      price: '199', // should be excluded — has mapsTo
      staleKey: 'old', // not in fields
      blobUrl: 'blob:http://localhost/abc',
    };
    const clean = sanitiseTemplateData(tpl, data);
    expect(clean['brand']).toBe('Acme');
    expect(clean['price']).toBeUndefined();
    expect(clean['staleKey']).toBeUndefined();
    expect(clean['blobUrl']).toBeUndefined();
  });

  it('sanitiseTemplateData preserves false and 0', () => {
    const tpl = {
      fields: [
        { key: 'flag', type: 'toggle' as const, label: 'Flag' },
        { key: 'count', type: 'number' as const, label: 'Count' },
      ],
    };
    const clean = sanitiseTemplateData(tpl, { flag: false, count: 0 });
    expect(clean['flag']).toBe(false);
    expect(clean['count']).toBe(0);
  });

  // ─── Restore ─────────────────────────────────────────────────────────────

  it('restoreTemplateValues reconstructs form values from Tag + templateData', () => {
    const tpl = {
      fields: [presets.price(), { key: 'brand', type: 'text' as const, label: 'Brand' }],
    };
    const tagFields = { price: 199 };
    const templateData = { brand: 'Acme' };
    const values = restoreTemplateValues(tpl, tagFields, templateData);
    expect(values['price']).toBe('199');
    expect(values['brand']).toBe('Acme');
  });

  it('restoreTemplateValues returns empty strings for missing values', () => {
    const tpl = { fields: [presets.price()] };
    const values = restoreTemplateValues(tpl, {}, null);
    expect(values['price']).toBe('');
  });

  // ─── Defaults resolver ──────────────────────────────────────────────────

  it('resolveTemplateDefaults returns only defined defaults', () => {
    const d = resolveTemplateDefaults({
      defaultIntent: 'offer',
      defaultCta: 'visit_shop',
      defaultExpiresIn: 1440,
    });
    expect(d.intent).toBe('offer');
    expect(d.cta).toBe('visit_shop');
    expect(d.expiresIn).toBe(1440);
  });

  it('resolveTemplateDefaults omits undefined values', () => {
    const d = resolveTemplateDefaults({});
    expect(d.intent).toBeUndefined();
    expect(d.cta).toBeUndefined();
    expect(d.expiresIn).toBeUndefined();
  });

  // ─── Expiry resolver ──────────────────────────────────────────────────

  it('resolveExpiry uses eventEnd when present', () => {
    const futureDate = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(); // 3h from now
    const tpl = {
      fields: [presets.eventEnd()],
      defaultExpiresIn: 1440,
    };
    const expiry = resolveExpiry(tpl, { eventEnd: futureDate });
    expect(expiry).toBeDefined();
    // 3h = 180 min + 60 buffer = ~240 min, should be near that
    expect(expiry!).toBeGreaterThan(200);
    expect(expiry!).toBeLessThan(300);
  });

  it('resolveExpiry falls back to defaultExpiresIn', () => {
    const tpl = {
      fields: [presets.eventEnd()],
      defaultExpiresIn: 1440,
    };
    const expiry = resolveExpiry(tpl, { eventEnd: '' });
    expect(expiry).toBe(1440);
  });

  it('resolveExpiry returns undefined when no defaults', () => {
    const tpl = { fields: [] as TemplateField[] };
    expect(resolveExpiry(tpl, {})).toBeUndefined();
  });

  // ─── buildHighlight handles missing optional values ─────────────────────

  it('buildHighlight produces clean output with only required fields', () => {
    const shopGeneral = POST_TEMPLATE_REGISTRY[TagCategory.Shop]!.find((t) => t.id === 'general')!;
    const text = shopGeneral.buildHighlight({
      item: 'Corner Store',
      dealType: 'New arrival',
      price: '',
      validUntil: '',
    });
    expect(text).toContain('Corner Store');
    expect(text).toContain('New arrival');
    expect(text).not.toContain('undefined');
    expect(text).not.toContain('null');
  });

  // ─── Personal posts unaffected ──────────────────────────────────────────

  it('personal categories are absent from the registry', () => {
    const personalCats = [
      TagCategory.Help,
      TagCategory.Game,
      TagCategory.Job,
      TagCategory.Notice,
      TagCategory.Dating,
      TagCategory.Alert,
      TagCategory.Around,
    ];
    for (const cat of personalCats) {
      expect(POST_TEMPLATE_REGISTRY[cat]).toBeUndefined(
        `${cat} should not be in the business registry`,
      );
    }
  });
});

// ─── Validation ──────────────────────────────────────────────────────────────

describe('Template validation — Step 2.A', () => {
  it('validates required fields', () => {
    const tpl = {
      fields: [
        { key: 'name', type: 'text' as const, label: 'Name', required: true },
        { key: 'note', type: 'text' as const, label: 'Note' },
      ],
    };
    const r = validateTemplateValues(tpl, { name: '', note: '' });
    expect(r.valid).toBeFalse();
    expect(r.errors['name']).toContain('required');
    expect(r.errors['note']).toBeUndefined();
  });

  it('validates price cannot be negative', () => {
    const tpl = { fields: [presets.price({ required: true })] };
    const r = validateTemplateValues(tpl, { price: '-5' });
    expect(r.valid).toBeFalse();
    expect(r.errors['price']).toBeTruthy();
  });

  it('validates number min/max', () => {
    const tpl = { fields: [presets.slotCount({ required: true })] };
    expect(validateTemplateValues(tpl, { slotCount: '0' }).valid).toBeFalse();
    expect(validateTemplateValues(tpl, { slotCount: '3' }).valid).toBeTrue();
  });

  it('validates URL fields', () => {
    const tpl = { fields: [presets.productLink({ required: true })] };
    expect(validateTemplateValues(tpl, { productLink: 'not-a-url' }).valid).toBeFalse();
    expect(validateTemplateValues(tpl, { productLink: 'https://example.com' }).valid).toBeTrue();
  });

  it('validates phone fields', () => {
    const tpl = { fields: [presets.phone({ required: true })] };
    expect(validateTemplateValues(tpl, { contactPhone: '+91 98765 43210' }).valid).toBeTrue();
    expect(validateTemplateValues(tpl, { contactPhone: 'abc' }).valid).toBeFalse();
  });

  it('validates select option membership', () => {
    const tpl = {
      fields: [
        {
          key: 'color',
          type: 'select' as const,
          label: 'Color',
          required: true,
          options: ['Red', 'Blue'],
        },
      ],
    };
    expect(validateTemplateValues(tpl, { color: 'Red' }).valid).toBeTrue();
    expect(validateTemplateValues(tpl, { color: 'Green' }).valid).toBeFalse();
  });

  it('validates multi-select option membership', () => {
    const tpl = {
      fields: [
        {
          key: 'tags',
          type: 'multi-select' as const,
          label: 'Tags',
          required: true,
          options: ['A', 'B', 'C'],
        },
      ],
    };
    expect(validateTemplateValues(tpl, { tags: 'A,B' }).valid).toBeTrue();
    expect(validateTemplateValues(tpl, { tags: 'A,Z' }).valid).toBeFalse();
  });

  it('validates maxLength', () => {
    const tpl = {
      fields: [{ key: 't', type: 'text' as const, label: 'T', maxLength: 5 }],
    };
    expect(validateTemplateValues(tpl, { t: '123456' }).valid).toBeFalse();
    expect(validateTemplateValues(tpl, { t: '12345' }).valid).toBeTrue();
  });

  it('cross-field: original price >= sale price', () => {
    const tpl = { fields: priceGroup({ required: true }, { required: true }) };
    const r = validateTemplateValues(tpl, { price: '200', originalPrice: '100' });
    expect(r.valid).toBeFalse();
    expect(r.errors['originalPrice']).toContain('higher');
  });

  it('cross-field: event end must be after start', () => {
    const tpl = { fields: eventGroup({ required: true }, { required: true }) };
    const r = validateTemplateValues(tpl, {
      eventStart: '2026-09-01T10:00',
      eventEnd: '2026-09-01T09:00',
    });
    expect(r.valid).toBeFalse();
    expect(r.errors['eventEnd']).toContain('after');
  });

  it('cross-field: valid event range passes', () => {
    const tpl = { fields: eventGroup({ required: true }, { required: true }) };
    const r = validateTemplateValues(tpl, {
      eventStart: '2026-09-01T10:00',
      eventEnd: '2026-09-01T18:00',
    });
    expect(r.valid).toBeTrue();
  });

  it('optional blank fields pass validation', () => {
    const tpl = {
      fields: [
        presets.price(),
        presets.originalPrice(),
        presets.productLink(),
        presets.description(),
      ],
    };
    const r = validateTemplateValues(tpl, {
      price: '',
      originalPrice: '',
      productLink: '',
      description: '',
    });
    expect(r.valid).toBeTrue();
  });

  it('calls template-level validate hook', () => {
    const tpl: Pick<PostTemplateDefinition, 'fields' | 'validate'> = {
      fields: [
        { key: 'a', type: 'text' as const, label: 'A' },
        { key: 'b', type: 'text' as const, label: 'B' },
      ],
      validate: (v: Record<string, string>): Record<string, string> => {
        if (v['a'] === v['b'] && v['a']) return { b: 'A and B must differ' };
        return {};
      },
    };
    const r = validateTemplateValues(tpl, { a: 'same', b: 'same' });
    expect(r.valid).toBeFalse();
    expect(r.errors['b']).toContain('differ');
  });
});
