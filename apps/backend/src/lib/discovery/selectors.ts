import type { Locator, Page } from 'playwright';
import type { RawElement, SelectorCandidate } from './types.js';

/**
 * Faz 7A — ham element sinyallerinden sıralı aday seçici listesi üretir.
 *
 * Sıra (CLAUDE.md, tasarım ilkesi 1):
 *   getByRole → getByTestId → getByLabel → getByPlaceholder → kararlı CSS
 *   → getByText → son çare kısa CSS yolu.
 * Otomatik üretilmiş görünen id/class değerleri elenir; tek bir XPath saklanmaz.
 */

/** `data-testid` dışındaki testid attribute'ları CSS adayına düşer. */
const DEFAULT_TEST_ID_ATTRIBUTE = 'data-testid';

/**
 * Bir id/class değerinin insan eliyle yazılmış (kararlı) görünüp görünmediği.
 * Hash benzeri desenler elenir: `css-1x2y3z`, `_a8f3`, `Button_3kd9x`, `a7f3c9b2`.
 */
export function isStableToken(token: string): boolean {
  if (token.length < 2 || token.length > 40) return false;
  if (/\d{4,}/.test(token)) return false;
  if (/^[0-9]/.test(token)) return false;
  // CSS-in-JS ön ekleri: css-1x2y3z, sc-bdVaJa, emotion-0, jsx-123
  if (/^(css|sc|jsx|emotion|styled|makeStyles|Mui[A-Za-z]+-)[-_]?[A-Za-z0-9]{4,}$/.test(token)) {
    return false;
  }
  // Alt çizgiyle başlayan üretilmiş adlar: _a8f3
  if (/^_[A-Za-z0-9]{3,}$/.test(token)) return false;
  // CSS Modules: Button_root__a8f3 / Button_a8f3x
  if (/__?[A-Za-z0-9]*\d[A-Za-z0-9]*$/.test(token) && /[a-z]\d|\d[a-z]/i.test(token)) return false;
  // Saf hex/rastgele görünüm: a7f3c9b2
  if (/^[a-f0-9]{6,}$/i.test(token)) return false;
  // Harf-rakam serpiştirilmiş kısa jetonlar: 1x2y3z
  const digits = (token.match(/\d/g) ?? []).length;
  if (digits >= 3 && digits / token.length > 0.3) return false;
  return true;
}

/** CSS seçicide kullanılacak değeri kaçırır (CSS.escape'in Node karşılığı). */
function escapeCss(value: string): string {
  return value.replace(/([^\w-])/g, '\$1');
}

/** Aynı adayın iki kez listelenmemesi için anahtar. */
const candidateKey = (c: SelectorCandidate): string => JSON.stringify(c);

export function buildCandidates(raw: RawElement): SelectorCandidate[] {
  const candidates: SelectorCandidate[] = [];
  const push = (candidate: SelectorCandidate) => {
    if (!candidates.some((c) => candidateKey(c) === candidateKey(candidate))) {
      candidates.push(candidate);
    }
  };

  // 1) getByRole(role, { name })
  if (raw.role !== 'generic' && raw.accessibleName) {
    push({ kind: 'role', role: raw.role, name: raw.accessibleName });
  }

  // 2) getByTestId
  if (raw.testId) {
    if (raw.testIdAttribute === DEFAULT_TEST_ID_ATTRIBUTE) {
      push({ kind: 'testId', value: raw.testId });
    } else if (raw.testIdAttribute) {
      push({ kind: 'css', value: `[${raw.testIdAttribute}="${raw.testId}"]` });
    }
  }

  // 3) getByLabel
  if (raw.labelText) push({ kind: 'label', value: raw.labelText });

  // 4) getByPlaceholder
  if (raw.placeholder) push({ kind: 'placeholder', value: raw.placeholder });

  // 5) Kararlı CSS (id → class kombinasyonu)
  if (raw.id && isStableToken(raw.id)) {
    push({ kind: 'css', value: `#${escapeCss(raw.id)}` });
  }
  const stableClasses = raw.classNames.filter(isStableToken).slice(0, 2);
  if (stableClasses.length > 0) {
    push({
      kind: 'css',
      value: `${raw.tagName}${stableClasses.map((c) => `.${escapeCss(c)}`).join('')}`,
    });
  }
  if (raw.inputType && raw.inputType !== 'text') {
    push({ kind: 'css', value: `input[type="${raw.inputType}"]` });
  }

  // 6) getByText — yalnızca kısa ve anlamlı metinler
  if (raw.text && raw.text.length <= 60) push({ kind: 'text', value: raw.text });

  // 7) Son çare: kısa CSS yolu
  if (raw.cssPath) push({ kind: 'css', value: raw.cssPath });

  return candidates;
}

/** Aday seçiciyi çalıştırılabilir Playwright locator'ına çevirir (7C de bunu kullanır). */
export function buildLocator(page: Page, candidate: SelectorCandidate): Locator {
  switch (candidate.kind) {
    case 'role':
      // `name` birebir eşleşir; kısmi eşleşme farklı elementi yakalayabilir.
      return page.getByRole(candidate.role as Parameters<Page['getByRole']>[0], {
        name: candidate.name,
        exact: true,
      });
    case 'testId':
      return page.getByTestId(candidate.value);
    case 'label':
      return page.getByLabel(candidate.value, { exact: true });
    case 'placeholder':
      return page.getByPlaceholder(candidate.value, { exact: true });
    case 'text':
      return page.getByText(candidate.value, { exact: true });
    case 'css':
      return page.locator(candidate.value);
  }
}

/** Kullanıcıya/raporlara gösterilecek kısa açıklama. */
export function describeCandidate(candidate: SelectorCandidate): string {
  switch (candidate.kind) {
    case 'role':
      return `getByRole('${candidate.role}', { name: '${candidate.name}' })`;
    case 'testId':
      return `getByTestId('${candidate.value}')`;
    case 'label':
      return `getByLabel('${candidate.value}')`;
    case 'placeholder':
      return `getByPlaceholder('${candidate.value}')`;
    case 'text':
      return `getByText('${candidate.value}')`;
    case 'css':
      return `locator('${candidate.value}')`;
  }
}
