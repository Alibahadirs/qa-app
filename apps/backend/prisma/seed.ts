import { prisma } from '../src/db.js';

/** Minimal, gerçekçi örnek veri — geliştirme sırasında arayüzü boş görmemek için. */
async function main() {
  await prisma.testSuiteCase.deleteMany();
  await prisma.testSuite.deleteMany();
  await prisma.testCase.deleteMany();

  const login = await prisma.testCase.create({
    data: {
      title: 'Geçerli kimlik bilgileriyle giriş yapılabiliyor',
      description: 'Kayıtlı bir kullanıcının standart giriş akışı.',
      steps: JSON.stringify([
        'Giriş sayfasını aç',
        'Geçerli e-posta ve şifreyi gir',
        '"Giriş yap" butonuna tıkla',
      ]),
      expectedResult: 'Kullanıcı panele yönlendirilir ve adı sağ üstte görünür.',
      priority: 'CRITICAL',
      tags: JSON.stringify(['auth', 'smoke']),
      isAutomatable: true,
      playwrightScriptPath: 'tests/smoke/test-cases.spec.ts',
    },
  });

  const wrongPassword = await prisma.testCase.create({
    data: {
      title: 'Hatalı şifre girişinde hata mesajı gösteriliyor',
      steps: JSON.stringify([
        'Giriş sayfasını aç',
        'Geçerli e-posta, hatalı şifre gir',
        '"Giriş yap" butonuna tıkla',
      ]),
      expectedResult: '"E-posta veya şifre hatalı" mesajı görünür, yönlendirme olmaz.',
      priority: 'HIGH',
      tags: JSON.stringify(['auth', 'negative']),
      isAutomatable: true,
      playwrightScriptPath: 'tests/smoke/bilerek-basarisiz.spec.ts',
    },
  });

  const exportPdf = await prisma.testCase.create({
    data: {
      title: 'Rapor PDF olarak dışa aktarılabiliyor',
      description: 'Tarayıcı indirme davranışı nedeniyle manuel doğrulama gerekir.',
      steps: JSON.stringify([
        'Raporlar sayfasını aç',
        'Bir rapor seç',
        '"PDF indir" butonuna tıkla',
      ]),
      expectedResult: 'PDF indirilir ve içeriği ekrandaki raporla aynıdır.',
      priority: 'MEDIUM',
      tags: JSON.stringify(['reporting']),
      isAutomatable: false,
    },
  });

  await prisma.testSuite.create({
    data: {
      name: 'Smoke Suite',
      description: 'Her sürüm öncesi çalıştırılan temel akışlar.',
      cases: {
        create: [
          { caseId: login.id, order: 0 },
          { caseId: wrongPassword.id, order: 1 },
          { caseId: exportPdf.id, order: 2 },
        ],
      },
    },
  });

  console.log('[seed] 3 test case + 1 suite oluşturuldu.');
}

main()
  .catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
