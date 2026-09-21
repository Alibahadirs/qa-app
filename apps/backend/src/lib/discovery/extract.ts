import type { RawElement } from './types.js';

/** Elementleri işaretlemek için sayfaya geçici olarak yazılan attribute. */
export const MARKER_ATTRIBUTE = 'data-qaapp-eid';

/**
 * Tarayıcı içinde (page.evaluate) çalışır — dışarıdaki hiçbir değişkene erişemez,
 * bu yüzden tüm yardımcılar fonksiyonun içinde tanımlıdır.
 *
 * Görünür ve etkileşilebilir elementleri toplar, her birine geçici bir işaret
 * yazar ve seçici üretimi için ham sinyalleri döner. Sayfa DOM'unda kalıcı bir
 * değişiklik bırakmaz (işaretler discover.ts sonunda silinir).
 */
export function extractElements(markerAttribute: string): RawElement[] {
  const INTERACTIVE_TAGS = ['a', 'button', 'input', 'select', 'textarea', 'summary'];
  const INTERACTIVE_ROLES = [
    'button',
    'link',
    'textbox',
    'searchbox',
    'checkbox',
    'radio',
    'combobox',
    'listbox',
    'switch',
    'slider',
    'tab',
    'menuitem',
    'option',
  ];
  const TEST_ID_ATTRIBUTES = ['data-testid', 'data-test-id', 'data-test', 'data-cy', 'data-qa'];

  const clean = (value: string | null | undefined): string =>
    (value ?? '').replace(/\s+/g, ' ').trim();

  const implicitRole = (el: Element): string => {
    const tag = el.tagName.toLowerCase();
    if (tag === 'a') return el.hasAttribute('href') ? 'link' : 'generic';
    if (tag === 'button' || tag === 'summary') return 'button';
    if (tag === 'select') return el.hasAttribute('multiple') ? 'listbox' : 'combobox';
    if (tag === 'textarea') return 'textbox';
    if (tag === 'input') {
      const type = (el.getAttribute('type') ?? 'text').toLowerCase();
      if (type === 'checkbox') return 'checkbox';
      if (type === 'radio') return 'radio';
      if (type === 'submit' || type === 'button' || type === 'reset') return 'button';
      if (type === 'search') return 'searchbox';
      if (type === 'range') return 'slider';
      if (type === 'number') return 'spinbutton';
      if (type === 'hidden' || type === 'file' || type === 'image' || type === 'color') {
        return type === 'file' ? 'button' : 'generic';
      }
      return 'textbox';
    }
    return 'generic';
  };

  const labelFor = (el: Element): string | null => {
    const id = el.getAttribute('id');
    if (id) {
      const escaped = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(id) : id;
      const label = document.querySelector(`label[for="${escaped}"]`);
      if (label) return clean(label.textContent) || null;
    }
    const wrapper = el.closest('label');
    if (wrapper) return clean(wrapper.textContent) || null;
    return null;
  };

  const accessibleName = (el: Element): string => {
    const ariaLabel = clean(el.getAttribute('aria-label'));
    if (ariaLabel) return ariaLabel;

    const labelledBy = clean(el.getAttribute('aria-labelledby'));
    if (labelledBy) {
      const parts = labelledBy
        .split(' ')
        .map((refId) => clean(document.getElementById(refId)?.textContent))
        .filter(Boolean);
      if (parts.length > 0) return parts.join(' ');
    }

    const label = labelFor(el);
    if (label) return label;

    const tag = el.tagName.toLowerCase();
    if (tag === 'input') {
      const type = (el.getAttribute('type') ?? 'text').toLowerCase();
      if (type === 'submit' || type === 'button' || type === 'reset') {
        const value = clean(el.getAttribute('value'));
        if (value) return value;
      }
    }
    if (tag === 'img') return clean(el.getAttribute('alt'));

    const ownText = clean(el.textContent);
    if (ownText) return ownText;

    const alt = clean(el.querySelector('img')?.getAttribute('alt'));
    if (alt) return alt;

    return clean(el.getAttribute('title')) || clean(el.getAttribute('placeholder'));
  };

  const isVisible = (el: Element): boolean => {
    const rect = el.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return false;
    const style = window.getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none') return false;
    return Number(style.opacity) > 0;
  };

  /** En fazla üç seviyelik, nth-of-type ile ayrıştırılmış kısa CSS yolu. */
  const cssPath = (el: Element): string => {
    const parts: string[] = [];
    let node: Element | null = el;
    let depth = 0;
    while (node && node !== document.body && depth < 3) {
      const tag = node.tagName.toLowerCase();
      const parent: Element | null = node.parentElement;
      if (!parent) {
        parts.unshift(tag);
        break;
      }
      const sameTag = Array.from(parent.children).filter((c) => c.tagName === node!.tagName);
      parts.unshift(sameTag.length > 1 ? `${tag}:nth-of-type(${sameTag.indexOf(node) + 1})` : tag);
      node = parent;
      depth += 1;
    }
    return parts.join(' > ');
  };

  const results: RawElement[] = [];
  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>(
      'a, button, input, select, textarea, summary, [role], [contenteditable=""], [contenteditable="true"], [onclick], [tabindex]',
    ),
  );

  let counter = 0;
  for (const el of candidates) {
    const tagName = el.tagName.toLowerCase();
    const explicitRole = clean(el.getAttribute('role')).toLowerCase();
    const role = explicitRole || implicitRole(el);

    if (!INTERACTIVE_TAGS.includes(tagName) && !INTERACTIVE_ROLES.includes(role)) continue;
    if (tagName === 'input' && (el.getAttribute('type') ?? '').toLowerCase() === 'hidden') continue;
    if (el.hasAttribute('disabled') || el.getAttribute('aria-hidden') === 'true') continue;
    if (!isVisible(el)) continue;

    counter += 1;
    const eid = `e${counter}`;
    el.setAttribute(markerAttribute, eid);

    let testId: string | null = null;
    let testIdAttribute: string | null = null;
    for (const attr of TEST_ID_ATTRIBUTES) {
      const value = clean(el.getAttribute(attr));
      if (value) {
        testId = value;
        testIdAttribute = attr;
        break;
      }
    }

    results.push({
      eid,
      tagName,
      role,
      accessibleName: accessibleName(el).slice(0, 200),
      testId,
      testIdAttribute,
      labelText: labelFor(el),
      placeholder: clean(el.getAttribute('placeholder')) || null,
      text: clean(el.textContent).slice(0, 200),
      id: clean(el.getAttribute('id')) || null,
      classNames: clean(el.getAttribute('class')).split(' ').filter(Boolean),
      cssPath: cssPath(el),
      inputType: tagName === 'input' ? (el.getAttribute('type') ?? 'text').toLowerCase() : null,
    });
  }

  return results;
}
