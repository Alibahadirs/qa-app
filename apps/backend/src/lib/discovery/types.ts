/**
 * Faz 7A — element keşfi tipleri.
 *
 * `RawElement` tarayıcı içinde toplanan ham sinyallerdir (extract.ts),
 * `SelectorCandidate` ise bu sinyallerden üretilen çalıştırılabilir seçicidir
 * (selectors.ts). Seçiciler XPath/uzun CSS olarak değil, Playwright locator
 * çağrısına birebir çevrilebilen yapısal nesneler olarak saklanır.
 */

/** Tarayıcı tarafında her element için toplanan ham sinyaller. */
export interface RawElement {
  /** Sayfaya geçici olarak yazılan işaret; seçici doğrulamasında kullanılır. */
  eid: string;
  tagName: string;
  role: string;
  /** Erişilebilir ad yaklaşımı (aria-label, label, buton metni...). */
  accessibleName: string;
  testId: string | null;
  /** `data-testid` dışında bir testid attribute'u kullanıldıysa adı. */
  testIdAttribute: string | null;
  labelText: string | null;
  placeholder: string | null;
  text: string;
  id: string | null;
  classNames: string[];
  /** Son çare: kısa, en fazla üç seviyelik CSS yolu. */
  cssPath: string;
  inputType: string | null;
}

export type SelectorCandidate =
  | { kind: 'role'; role: string; name: string }
  | { kind: 'testId'; value: string }
  | { kind: 'label'; value: string }
  | { kind: 'placeholder'; value: string }
  | { kind: 'css'; value: string }
  | { kind: 'text'; value: string };

/** DB'ye yazılan/istemciye dönen element kaydı. */
export interface DiscoveredElement {
  key: string;
  label: string;
  role: string;
  tagName: string;
  candidateSelectors: SelectorCandidate[];
}
