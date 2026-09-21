/**
 * Faz 7B — senaryo metin dili: satır tabanlı, çift yönlü (metin ↔ adım listesi).
 *
 * Dilbilgisi (her satır bir adım; boş satırlar ve `#` ile başlayan satırlar yok sayılır):
 *
 *   git: <url>                         → GOTO
 *   tikla: <hedef>                     → CLICK
 *   yaz: <hedef> = <deger>             → TYPE
 *   sec: <hedef> = <deger>             → SELECT
 *   bekle: <n>ms                       → WAIT (sabit süre)
 *   bekle: url içerir <parça>          → WAIT (URL koşulu)
 *   bekle: gorunur = <hedef>           → WAIT (element görünür)
 *   dogrula: metin = <metin>           → ASSERT_TEXT
 *   dogrula: gorunur = <hedef>         → ASSERT_VISIBLE
 *   dogrula: gizli = <hedef>           → ASSERT_NOT_VISIBLE
 *   dogrula: url içerir <parça>        → ASSERT_URL
 *   dogrula: deger: <hedef> = <deger>  → ASSERT_VALUE
 *
 * Hedefler element **etiketiyle** yazılır; ayrıştırıcı etiketi katalogdaki PageElement
 * id'sine çevirir. Bilinmeyen ya da birden fazla elementle eşleşen etiket hata üretir —
 * böylece kaydedilen her metin çalıştırılabilir bir senaryoya karşılık gelir.
 */

export type StepAction =
  | 'GOTO'
  | 'CLICK'
  | 'TYPE'
  | 'SELECT'
  | 'WAIT'
  | 'ASSERT_TEXT'
  | 'ASSERT_VISIBLE'
  | 'ASSERT_NOT_VISIBLE'
  | 'ASSERT_URL'
  | 'ASSERT_VALUE';

/** Hedeflerin etikete çevrilebilmesi için gereken en küçük katalog görünümü. */
export interface ElementRef {
  id: string;
  label: string;
}

export interface ParsedStep {
  action: StepAction;
  targetElementId: string | null;
  value: string | null;
  timeoutMs: number | null;
}

export interface ParseIssue {
  /** 1'den başlayan satır numarası (boş satırlar dahil; kullanıcıya gösterilir). */
  line: number;
  message: string;
}

export interface ParseResult {
  steps: ParsedStep[];
  errors: ParseIssue[];
  warnings: string[];
}

const ASSERTION_ACTIONS: StepAction[] = [
  'ASSERT_TEXT',
  'ASSERT_VISIBLE',
  'ASSERT_NOT_VISIBLE',
  'ASSERT_URL',
  'ASSERT_VALUE',
];

/**
 * Tasarım ilkesi 3: doğrulama adımı olmayan senaryo yalnızca "çökmedi"yi ölçer.
 * Kaydı engellemiyoruz ama her kayıtta uyarı dönüyoruz.
 */
export function assertionWarnings(steps: { action: StepAction }[]): string[] {
  const hasAssertion = steps.some((s) => ASSERTION_ACTIONS.includes(s.action));
  return hasAssertion
    ? []
    : ['Senaryoda hiç doğrulama adımı yok — bu senaryo yalnızca "çökmedi"yi ölçer.'];
}

const URL_KEYWORD = 'url içerir ';
/** Elle yazarken "içerir" yerine "icerir" de kabul edilir; üretilen metin her zaman düzgün yazılır. */
const URL_PATTERN = /^url\s+i[çc]erir\s+/i;

/** `url içerir <parça>` ise parçayı döner, değilse null. */
function matchUrlKeyword(argument: string): string | null {
  const match = URL_PATTERN.exec(argument);
  return match ? argument.slice(match[0].length).trim() : null;
}

/** `1500ms`, `1500 ms`, `2s`, `2 sn` → milisaniye. */
function parseDuration(text: string): number | null {
  const match = /^(\d+)\s*(ms|s|sn|saniye)$/i.exec(text.trim());
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = (match[2] ?? 'ms').toLowerCase();
  return unit === 'ms' ? amount : amount * 1000;
}

/** `hedef = deger` → [hedef, deger]; ilk `=` işaretinden bölünür. */
function splitAssignment(text: string): [string, string] | null {
  const index = text.indexOf('=');
  if (index === -1) return null;
  const left = text.slice(0, index).trim();
  const right = text.slice(index + 1).trim();
  if (!left) return null;
  return [left, right];
}

export function parseScenarioText(text: string, elements: ElementRef[]): ParseResult {
  const errors: ParseIssue[] = [];
  const steps: ParsedStep[] = [];

  /** Etiketi element id'sine çevirir; belirsiz/bilinmeyen etiket hata üretir. */
  const resolve = (label: string, line: number): string | null => {
    const matches = elements.filter((e) => e.label === label);
    if (matches.length === 1) return matches[0]!.id;
    if (matches.length === 0) {
      errors.push({ line, message: `Katalogda böyle bir element yok: "${label}"` });
    } else {
      errors.push({
        line,
        message: `"${label}" etiketi ${matches.length} elementle eşleşiyor, hangisi olduğu belirsiz`,
      });
    }
    return null;
  };

  text.split(/\r?\n/).forEach((rawLine, index) => {
    const line = index + 1;
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('#')) return;

    const colon = trimmed.indexOf(':');
    if (colon === -1) {
      errors.push({ line, message: `Komut eksik (örn. "tikla: Giriş yap"): "${trimmed}"` });
      return;
    }
    const command = trimmed.slice(0, colon).trim().toLowerCase();
    const argument = trimmed.slice(colon + 1).trim();
    if (!argument) {
      errors.push({ line, message: `"${command}" komutunun argümanı boş` });
      return;
    }

    const push = (step: ParsedStep) => steps.push(step);
    const withTarget = (action: StepAction, label: string, value: string | null = null) => {
      const id = resolve(label, line);
      if (id) push({ action, targetElementId: id, value, timeoutMs: null });
    };

    switch (command) {
      case 'git':
        push({ action: 'GOTO', targetElementId: null, value: argument, timeoutMs: null });
        return;

      case 'tikla':
        withTarget('CLICK', argument);
        return;

      case 'yaz':
      case 'sec': {
        const pair = splitAssignment(argument);
        if (!pair) {
          errors.push({ line, message: `"${command}" için biçim: ${command}: Hedef = değer` });
          return;
        }
        withTarget(command === 'yaz' ? 'TYPE' : 'SELECT', pair[0], pair[1]);
        return;
      }

      case 'bekle': {
        const duration = parseDuration(argument);
        if (duration !== null) {
          push({ action: 'WAIT', targetElementId: null, value: null, timeoutMs: duration });
          return;
        }
        const urlFragment = matchUrlKeyword(argument);
        if (urlFragment !== null) {
          if (!urlFragment) {
            errors.push({ line, message: 'Beklenen URL parçası boş' });
            return;
          }
          push({ action: 'WAIT', targetElementId: null, value: urlFragment, timeoutMs: null });
          return;
        }
        const pair = splitAssignment(argument);
        if (pair && pair[0].toLowerCase() === 'gorunur') {
          withTarget('WAIT', pair[1]);
          return;
        }
        errors.push({
          line,
          message:
            'Geçersiz bekleme. Biçimler: "bekle: 1500ms", "bekle: url içerir /panel", "bekle: gorunur = Çıkış"',
        });
        return;
      }

      case 'dogrula': {
        const assertUrlFragment = matchUrlKeyword(argument);
        if (assertUrlFragment !== null) {
          if (!assertUrlFragment) {
            errors.push({ line, message: 'Doğrulanacak URL parçası boş' });
            return;
          }
          push({
            action: 'ASSERT_URL',
            targetElementId: null,
            value: assertUrlFragment,
            timeoutMs: null,
          });
          return;
        }

        if (argument.toLowerCase().startsWith('deger:')) {
          const rest = argument.slice('deger:'.length).trim();
          const pair = splitAssignment(rest);
          if (!pair) {
            errors.push({ line, message: 'Biçim: dogrula: deger: Hedef = beklenen değer' });
            return;
          }
          withTarget('ASSERT_VALUE', pair[0], pair[1]);
          return;
        }

        const pair = splitAssignment(argument);
        if (!pair) {
          errors.push({
            line,
            message:
              'Geçersiz doğrulama. Biçimler: "dogrula: metin = ...", "dogrula: gorunur = ...", "dogrula: gizli = ...", "dogrula: url içerir ...", "dogrula: deger: Hedef = ..."',
          });
          return;
        }
        const [kind, operand] = pair;
        switch (kind.toLowerCase()) {
          case 'metin':
            push({ action: 'ASSERT_TEXT', targetElementId: null, value: operand, timeoutMs: null });
            return;
          case 'gorunur':
            withTarget('ASSERT_VISIBLE', operand);
            return;
          case 'gizli':
            withTarget('ASSERT_NOT_VISIBLE', operand);
            return;
          default:
            errors.push({ line, message: `Bilinmeyen doğrulama türü: "${kind}"` });
        }
        return;
      }

      default:
        errors.push({ line, message: `Bilinmeyen komut: "${command}"` });
    }
  });

  return { steps, errors, warnings: assertionWarnings(steps) };
}

/** Adım listesini metne çevirir — `parseScenarioText`'in tam tersi. */
export function generateScenarioText(steps: ParsedStep[], elements: ElementRef[]): string {
  const labelOf = (id: string | null): string => elements.find((e) => e.id === id)?.label ?? '???';

  return steps
    .map((step) => {
      switch (step.action) {
        case 'GOTO':
          return `git: ${step.value ?? ''}`;
        case 'CLICK':
          return `tikla: ${labelOf(step.targetElementId)}`;
        case 'TYPE':
          return `yaz: ${labelOf(step.targetElementId)} = ${step.value ?? ''}`;
        case 'SELECT':
          return `sec: ${labelOf(step.targetElementId)} = ${step.value ?? ''}`;
        case 'WAIT':
          if (step.targetElementId) return `bekle: gorunur = ${labelOf(step.targetElementId)}`;
          if (step.value) return `bekle: ${URL_KEYWORD}${step.value}`;
          return `bekle: ${step.timeoutMs ?? 0}ms`;
        case 'ASSERT_TEXT':
          return `dogrula: metin = ${step.value ?? ''}`;
        case 'ASSERT_VISIBLE':
          return `dogrula: gorunur = ${labelOf(step.targetElementId)}`;
        case 'ASSERT_NOT_VISIBLE':
          return `dogrula: gizli = ${labelOf(step.targetElementId)}`;
        case 'ASSERT_URL':
          return `dogrula: ${URL_KEYWORD}${step.value ?? ''}`;
        case 'ASSERT_VALUE':
          return `dogrula: deger: ${labelOf(step.targetElementId)} = ${step.value ?? ''}`;
      }
    })
    .join('\n');
}

/** Metinde/adımlarda geçen `{{degisken}}` adları (sırayla, tekrarsız). */
export function collectVariables(steps: ParsedStep[]): string[] {
  const names: string[] = [];
  for (const step of steps) {
    for (const match of (step.value ?? '').matchAll(/\{\{\s*([\w.-]+)\s*\}\}/g)) {
      const name = match[1]!;
      if (!names.includes(name)) names.push(name);
    }
  }
  return names;
}
