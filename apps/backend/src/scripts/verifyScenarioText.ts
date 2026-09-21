/**
 * Faz 7B doğrulaması — "çift yönlü dönüşümün kayıpsızlığı test edilir" (CLAUDE.md).
 *
 * Üç şey kanıtlanır:
 *   1. metin → adım → metin dönüşümü metni birebir geri verir,
 *   2. adım → metin → adım dönüşümü adım listesini birebir geri verir,
 *   3. hatalı satırlar satır numarasıyla birlikte reddedilir (sessizce yutulmaz).
 *
 * Veritabanı gerektirmez: ayrıştırıcı/üretici saf fonksiyonlardır.
 * Çalıştırma: pnpm --filter @qa-app/backend test
 */
import {
  collectVariables,
  generateScenarioText,
  parseScenarioText,
  type ElementRef,
  type ParsedStep,
} from '../lib/scenario/text.js';

const elements: ElementRef[] = [
  { id: 'el-eposta', label: 'E-posta' },
  { id: 'el-sifre', label: 'Şifre' },
  { id: 'el-giris', label: 'Giriş yap' },
  { id: 'el-cikis', label: 'Çıkış' },
  { id: 'el-rol', label: 'Rol' },
  { id: 'el-hata', label: 'Hata mesajı' },
  { id: 'el-sil-1', label: 'Sil' },
  { id: 'el-sil-2', label: 'Sil' },
];

/** Her adım tipini en az bir kez kullanan referans senaryo. */
const REFERENCE_TEXT = [
  'git: https://ornek.com/giris',
  'yaz: E-posta = test@ornek.com',
  'yaz: Şifre = {{sifre}}',
  'sec: Rol = admin',
  'tikla: Giriş yap',
  'bekle: 1500ms',
  'bekle: url içerir /panel',
  'bekle: gorunur = Çıkış',
  'dogrula: metin = Hoş geldiniz',
  'dogrula: gorunur = Çıkış',
  'dogrula: gizli = Hata mesajı',
  'dogrula: url içerir /panel',
  'dogrula: deger: E-posta = test@ornek.com',
].join('\n');

const failures: string[] = [];
const check = (ok: boolean, message: string) => {
  if (ok) {
    console.log(`  ✓ ${message}`);
  } else {
    failures.push(message);
    console.error(`  ✗ ${message}`);
  }
};

console.log('metin → adım → metin');
const first = parseScenarioText(REFERENCE_TEXT, elements);
check(first.errors.length === 0, `referans senaryo hatasız ayrıştı (${first.steps.length} adım)`);
if (first.errors.length > 0) console.error(first.errors);
check(first.steps.length === 13, 'her adım tipi ayrı bir adıma dönüştü');

const regenerated = generateScenarioText(first.steps, elements);
check(regenerated === REFERENCE_TEXT, 'üretilen metin kaynakla birebir aynı');
if (regenerated !== REFERENCE_TEXT) {
  REFERENCE_TEXT.split('\n').forEach((line, i) => {
    const other = regenerated.split('\n')[i];
    if (line !== other) console.error(`    satır ${i + 1}: "${line}" ≠ "${other}"`);
  });
}

console.log('\nadım → metin → adım');
const second = parseScenarioText(regenerated, elements);
check(second.errors.length === 0, 'üretilen metin yeniden hatasız ayrıştı');
check(
  JSON.stringify(second.steps) === JSON.stringify(first.steps),
  'adım listesi tur sonunda birebir korundu',
);

console.log('\nuyarılar ve değişkenler');
check(first.warnings.length === 0, 'doğrulama içeren senaryo uyarı üretmiyor');
const clickOnly = parseScenarioText('git: https://ornek.com\ntikla: Giriş yap', elements);
check(
  clickOnly.warnings.length === 1,
  'doğrulama adımı olmayan senaryo uyarı üretiyor (tasarım ilkesi 3)',
);
check(
  JSON.stringify(collectVariables(first.steps)) === JSON.stringify(['sifre']),
  '{{sifre}} değişkeni toplandı',
);

console.log('\nhatalı girdiler');
const broken = parseScenarioText(
  [
    'git: https://ornek.com',
    'ziplama: bir yere', // bilinmeyen komut
    'tikla: Olmayan Buton', // katalogda yok
    'tikla: Sil', // iki elementle eşleşiyor
    'yaz: E-posta', // "=" yok
    'bekle: bir süre', // geçersiz bekleme
    'dogrula: renk = kırmızı', // bilinmeyen doğrulama türü
  ].join('\n'),
  elements,
);
check(broken.errors.length === 6, `6 hatalı satırın hepsi raporlandı (${broken.errors.length})`);
check(
  broken.errors.every((e) => e.line >= 2 && e.line <= 7),
  'hatalar doğru satır numaralarıyla raporlandı',
);
check(broken.steps.length === 1, 'yalnızca geçerli satır adıma dönüştü');

console.log('\nelle yazım toleransı');
const ascii = parseScenarioText('dogrula: url icerir /panel', elements);
check(
  ascii.errors.length === 0 && ascii.steps[0]?.value === '/panel',
  '"icerir" (şapkasız) da kabul ediliyor',
);
check(
  generateScenarioText(ascii.steps, elements) === 'dogrula: url içerir /panel',
  'üretilen metin her zaman düzgün yazımla çıkıyor',
);

console.log('\nyorum ve boş satırlar');
const withComments = parseScenarioText(
  '# giriş akışı\n\ngit: https://ornek.com\n\n  # ara not\ndogrula: metin = Hoş geldiniz\n',
  elements,
);
check(withComments.errors.length === 0 && withComments.steps.length === 2, 'yok sayıldı');

if (failures.length > 0) {
  console.error(`\n${failures.length} doğrulama hatası.`);
  process.exit(1);
}
console.log('\nÇift yönlü senaryo yazımı kayıpsız.');
