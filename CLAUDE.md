# Test Yönetim Uygulaması — Claude Code Geliştirme Promptu

## 1. Proje Vizyonu

Hem manuel test süreçlerini (test case yazma, test planı/suite oluşturma, manuel çalıştırma ve sonuç kaydetme) kolaylaştıran, hem de bu test case'lerin bir kısmını Playwright ile otomatize edilebilir hale getiren bir web uygulaması geliştiriyoruz.

Temel kullanıcı akışı:

1. Kullanıcı test case'leri yazar (başlık, adımlar, beklenen sonuç, öncelik, etiketler).
2. Test case'leri test suite/plan'lara gruplar.
3. Bir "test run" başlatır, her case için manuel olarak Pass/Fail/Blocked/Skipped işaretler, ekran görüntüsü/not ekler.
4. Uygun case'leri "otomatize edilebilir" olarak işaretleyip Playwright script'ine bağlar.
5. Otomatize edilmiş case'leri uygulama üzerinden tetikleyip sonucu (Playwright raporu) aynı dashboard'da görür.
6. Manuel ve otomatik sonuçları birlikte gösteren bir raporlama/dashboard ekranı olur.

## 2. Teknoloji Yığını (Karar Verildi)

- **Frontend:** React + TypeScript + Vite, UI için Tailwind CSS
- **Backend:** Node.js + TypeScript + Express (veya Fastify)
- **Veritabanı:** SQLite (geliştirme) + Prisma ORM (ileride Postgres'e geçiş kolay olsun diye)
- **Otomasyon entegrasyonu:** Playwright (Test Runner API / CLI ile backend'den tetiklenecek, JSON raporu parse edilip DB'ye yazılacak)
- **Paket yöneticisi:** pnpm

Tek dil (TypeScript) hem frontend hem backend'de kullanılacak — bu, Claude Code'un context switch yapmadan çalışmasını sağlar ve token maliyetini düşürür.

**Önemli kısıtlama:** Uygulamanın kendisi (production'da çalışan hâli) hiçbir şekilde bir LLM/AI API'sine (Claude API dahil) istek atmayacak. "AI destekli test önerisi", "otomatik test case üretimi" gibi özellikler önerme veya ekleme — bunlar gerçek kullanım sırasında token/API maliyeti doğurur ve bu projenin kapsamı dışında. Token maliyeti sadece geliştirme sırasında Claude Code'u kullanmaktan kaynaklanır, bittikten sonra sıfır olmalı.

## 3. Token Verimliliği Kuralları (Zorunlu — Her Fazda Uygula)

- Kod yazmadan önce kısa bir plan sun, onay bekle. Onaysız dosya oluşturma/düzenleme yapma.
- Sadece ilgili dosyaları oku; tüm projeyi taramak yerine hedefli grep/glob kullan.
- Her faz kendi başına bağımsız bir iş birimi — bir faz bitince özetle ve dur, otomatik olarak sıradaki faza geçme.
- Uzun açıklama yazma; değişiklikleri kısa madde işaretleriyle özetle.
- Aynı dosyada yapılacak birden fazla küçük değişikliği tek seferde topla, tek tek deneme-yanılma yapma.
- Yeni bir pakete ihtiyaç olursa önce sor, sürüm tahmini yapıp doğrudan kurma.
- Test/örnek veri üretirken minimal ve gerçekçi tut, gereksiz büyük mock veri seti oluşturma.
- Karmaşık çok dosyalı araştırma gerekiyorsa (örn. "tüm proje yapısını analiz et") sub-agent/Task kullan, ana context'i şişirme.

## 4. Faz Planı (Her Fazı Ayrı Session'da Çalıştır, Aralarında `/clear` Kullan)

### Faz 0 — İskelet Kurulumu

- pnpm monorepo yapısı (`apps/frontend`, `apps/backend`, `packages/shared` gibi) veya basit iki klasörlü yapı.
- Backend: Express + TypeScript + Prisma kurulumu, boş sağlık kontrolü endpoint'i (`GET /health`).
- Frontend: Vite + React + TypeScript + Tailwind kurulumu, boş ana sayfa.
- `.gitignore`, `README.md`, temel `package.json` script'leri (`dev`, `build`, `test`).
- **Çıktı:** Çalışan boş bir iskelet, backend ve frontend ayrı ayrı `pnpm dev` ile ayağa kalkabiliyor.

### Faz 1 — Veri Modeli ve Backend API (Test Case & Suite CRUD)

- Prisma şeması: `TestCase` (id, başlık, adımlar[], beklenen sonuç, öncelik, etiketler, otomatize edilebilir mi, playwright script yolu), `TestSuite` (id, ad, açıklama, case'ler), `TestRun`, `TestResult` (case, run, status, not, ekran görüntüsü linki, tarih).
- CRUD endpoint'leri: `/test-cases`, `/test-suites`.
- Basit input validasyonu (zod).
- **Çıktı:** Postman/curl ile test edilebilir çalışan API.

### Faz 2 — Frontend: Test Case ve Suite Yönetimi

- Test case listesi, oluşturma/düzenleme formu.
- Suite'e case ekleme/çıkarma arayüzü.
- Basit filtreleme (öncelik, etiket, otomatize edilebilir mi).
- **Çıktı:** Kullanıcı tarayıcıdan test case ve suite'leri yönetebiliyor.

### Faz 3 — Manuel Test Çalıştırma (Test Run)

- `TestRun` başlatma: bir suite seçilir, case'ler sıraya dizilir.
- Her case için Pass/Fail/Blocked/Skipped işaretleme ekranı, not ve ekran görüntüsü (dosya upload) alanı.
- Run tamamlandığında özet ekranı (kaç pass/fail vs.).
- **Çıktı:** Uçtan uca manuel test çalıştırma akışı çalışıyor.

### Faz 4 — Playwright Otomasyon Entegrasyonu

- "Otomatize edilebilir" işaretli case'lere bir Playwright test dosyası (`.spec.ts`) bağlama alanı.
- Backend'den `npx playwright test <dosya> --reporter=json` tetikleme (child_process), sonucu parse edip `TestResult`'a yazma.
- Frontend'de "Otomatik Çalıştır" butonu, sonucu canlı/yakın zamanlı gösterme.
- **Çıktı:** Bir case'i tek tıkla otomatik çalıştırıp sonucu uygulamada görebiliyorsun.

### Faz 5 — Raporlama / Dashboard

- Genel dashboard: toplam case sayısı, son run'ların pass/fail oranı, manuel vs otomatik dağılımı (basit grafik).
- Run geçmişi ve detay sayfası.
- **Çıktı:** Tek bakışta test sağlığını gösteren dashboard.

### Faz 6 — Cilalama (Opsiyonel, İhtiyaca Göre)

- Kimlik doğrulama (tek kullanıcı/takım için basit auth).
- Dışa aktarma (CSV/PDF rapor).
- CI entegrasyonu (GitHub Actions'ta otomatik case'leri çalıştırma).


### Faz 7 — Kodsuz Senaryo Otomasyonu

Faz 4'te otomatik test için `.spec.ts` dosyasını kullanıcı yazıyordu. Faz 7, senaryoyu
arayüzden kurmayı sağlar: **kod yazmadan** adım adım senaryo tanımla, çalıştır, rapor al.
Mevcut `playwrightScriptPath` yolu kaldırılmaz — senaryo, ikinci bir otomasyon yöntemidir.

**Tasarım ilkeleri (pazarlık konusu değil):**

1. **Seçici dayanıklılığı her şeyden önemli.** Tek bir XPath saklamak yasak. Her element
   için sıralı bir **aday seçici listesi** üretilir ve saklanır:
   `getByRole(role, {name})` → `getByTestId` → `getByLabel` → `getByPlaceholder` →
   kararlı CSS (id/class) → `getByText` → son çare kısa CSS yolu.
   Otomatik üretilmiş görünen id/class'lar (hash benzeri desenler: `css-1x2y3z`, `_a8f3`,
   yoğun rakam) elenir.
2. **Çalışma anında kademeli düşme.** İlk aday tutmazsa sıradaki denenir. Hangi adayın
   tuttuğu kaydedilir; ilk aday dışında bir şey tuttuysa adım "geçti (uyarı: seçici kaydı)"
   olarak işaretlenir ve raporda gösterilir. **Bu, sayfanın değiştiğinin erken habercisidir
   ve ürünün en değerli özelliğidir.**
3. **Doğrulama adımı olmadan senaryo kaydedilemez.** Sadece tıklayan bir senaryo yalnızca
   "çökmedi"yi ölçer. En az bir doğrulama adımı zorunludur (uyarı verilir).
4. **Element keşfi süreklidir.** Başlangıç URL'i kataloglanır; senaryo yeni bir sayfaya
   geçtiğinde o sayfa da kataloglanır.

**Veri modeli eklentileri:**

| Model | Alanlar |
| --- | --- |
| `Scenario` | id, ad, açıklama?, baseUrl, testCaseId? (mevcut case'e bağlama), createdAt, updatedAt |
| `ScenarioStep` | id, scenarioId, order, action, targetElementId?, value?, timeoutMs? |
| `PageElement` | id, scenarioId, pageUrl, etiket (görünen ad), role, tagName, candidateSelectors (sıralı JSON), discoveredAt |
| `StepResult` | id, testResultId, stepId, status, durationMs, usedSelectorIndex, screenshotPath?, error? |

**Adım tipleri:** `GOTO`, `CLICK`, `TYPE`, `SELECT`, `WAIT` (süre / element / URL),
`ASSERT_TEXT`, `ASSERT_VISIBLE`, `ASSERT_NOT_VISIBLE`, `ASSERT_URL`, `ASSERT_VALUE`.

**Çift yönlü senaryo yazımı:** Aynı senaryo hem form tabanlı adım editöründe hem de
metin olarak görüntülenir; ikisi arasında kayıpsız geçilebilir. Metin dili satır tabanlı:

```
git: https://ornek.com/giris
yaz: E-posta = test@ornek.com
yaz: Şifre = {{sifre}}
tikla: Giriş yap
bekle: url içerir /panel
dogrula: metin = Hoş geldiniz
dogrula: gorunur = Çıkış
```

`{{degisken}}` ile parametre kullanılır; parola gibi değerler senaryo metnine düz yazılmaz,
ayrı bir değişken deposunda tutulur.

**Alt fazlar (tek seferde yapılmaz):**

- **7A — Element keşfi ve seçici üretimi.** Bir URL verildiğinde tıklanabilir/yazılabilir
  elementleri çıkaran, her biri için aday seçici listesi üreten servis + API.
  *Doğrulama:* gerçek bir sayfada üretilen seçicilerin hepsi Playwright ile tek tek
  denenir ve o elementi bulduğu kanıtlanır.
- **7B — Senaryo modeli ve metin dili.** CRUD + ayrıştırıcı/üretici (metin ↔ adım listesi),
  çift yönlü dönüşümün kayıpsızlığı test edilir.
- **7C — Adım çalıştırıcı.** Playwright ile adım adım yürütme, kademeli seçici düşme,
  adım bazlı sonuç, hata anında ekran görüntüsü. Mevcut `TestRun`/`TestResult` yapısına bağlanır.
- **7D — Arayüz.** Element kataloğu, adım editörü, metin görünümü, "çalıştır" ve adım adım rapor.

**Çıktı:** Bir URL verip arayüzden senaryo kurabiliyor, tek tıkla çalıştırıp hangi adımda
ne olduğunu ekran görüntüsüyle görebiliyorum.

### Faz 7 sonrası cila (tamamlandı)

Faz 7 bittikten sonra uygulama uçtan uca elle denendi ve çıkan eksikler kapatıldı:

- **Değişken deposu arayüzü.** Backend ucu vardı ama hiçbir bileşen çağırmıyordu; yani
  `{{sifre}}` kullanan senaryo arayüzden çalıştırılamıyordu. Artık düzenlenebilir.
  Gizli değerler istemciye hiç gönderilmediği için `value` alanı opsiyonel:
  gönderilmeyen değişkenin saklı değeri korunur.
- **Katalog hatası yol gösterir.** Hedef henüz taranmamış bir sayfadaysa mesaj
  "…elementin bulunduğu adresi *Sayfayı tara* ile kataloglayın" der.
- **Doğrulama uyarısı belirgin.** Nötr bilgi değil sarı uyarı; senaryo listesinde de
  "⚠ doğrulama yok" rozeti (ilke 3).
- **Seçici kayması toplu raporu.** Kayma tek bir koşu raporuna gömülü kalmıyor,
  dashboard'da ayrı kart olarak toplanıyor (ilke 2).

### Faz 8 — Şablonlar, zamanlama, çoklu tarayıcı, görünürlük (tamamlandı)

- **8A — Senaryo şablonları.** `ScenarioTemplate` adımları değil **metin dilindeki
  gövdeyi** saklar: adımlar element id'lerine bağlıdır ve id'ler senaryoya özeldir,
  oysa metin etiketlere dayanır ve taşınabilir. "Şablon olarak kaydet" ve "Şablondan
  senaryo kur" (adres taranır, sonra metin yeni kataloğa göre çözülür).
  *Kabul edilen kısıt:* şablon etiketlere dayandığı için her sayfada tutmaz. Tutmazsa
  senaryo adımsız kurulur ve metin, satır numaralı hatalarıyla editöre düşer — bu bir
  hata değil, tasarlanmış davranıştır.
- **8B — Zamanlanmış çalıştırma.** Paket eklenmeden, dakikada bir tetiklenen tek bir
  tick. İki biçim: "her N dakikada" ve "her gün HH:MM" (cron ifadesi yok).
  `ScenarioRun.trigger` elle/zamanlanmış ayrımını taşır. Çalıştırma kilidi paylaşılır,
  zamanlayıcı kullanıcının başlattığı koşunun üstüne binmez.
  *Kabul edilen sınırlar:* yalnız backend ayaktayken çalışır, **kaçan koşular telafi
  edilmez**, kilit süreç içi olduğu için **tek backend örneği** varsayar.
- **8C — Çoklu tarayıcı.** Chromium / Firefox / WebKit. Adımlarda değişiklik
  gerekmedi; seçiciler zaten motor bağımsız üretiliyor. Tarayıcı kurulu değilse koşu
  BLOCKED olur ve hata mesajı kurulum komutunu verir. Zamanlama da tarayıcı taşır.
- **8D — Görünürlük.** Zamanlanmış koşular arka planda düşebildiği için sonuç tek
  yerde toplanır: dashboard'da "Senaryo sağlığı" kartı (son koşusu başarısız olan
  senaryolar, hangi adımda düştüğü), senaryo listesinde son koşu + zamanlama özeti,
  ve `/scenarios/schedules` sayfasında sıradaki koşular.

### Test kapsaması (sürdürülmeli)

Faz 7 ve 8 akışları `apps/e2e/tests/scenario/` altında regresyona karşı kapalı.
Yeni bir özellik eklerken buraya da test yazılır.

- `demoSite.ts` — testin kendi sürecinde ayağa kalkan hedef site. "drift" anahtarı
  butonun görünen adını değiştirip `data-testid`'i bırakır, böylece kademeli seçici
  düşme gerçek bir sayfa değişikliğiyle sınanır.
- `helpers.ts` — senaryo kurma/tarama/metin yazma/çalıştırma + API'den temizlik.
  Her spec kendi verisini `afterAll`'da siler.
- `globalSetup.ts` — auth açıkken bir kez giriş yapıp oturumu saklar.
- `apps/e2e/tests/core/` — çekirdek modüller: manuel run arayüz akışı, dar ekran taşması
  ve veri bütünlüğü/güvenlik regresyonları (geçmişi olan case/suite silinemez — 409,
  yükleme uzantısı mimetype'tan + imza kontrolü, CSV formül nötrleme, Türkçe arama).
- Backend tarafında `apps/backend/src/scripts/verify*.ts` betikleri gerçek tarayıcı ve
  gerçek veritabanıyla çalışır (`pnpm --filter @qa-app/backend test`).

## 5. Kullanım Talimatı

1. Bu dosya proje kökünde `CLAUDE.md` olarak durur; Claude Code her session'da otomatik okur.
2. Yeni bir session'da: "CLAUDE.md'yi oku. Faz 0'ı uygula. Önce kısa bir plan sun, onaylayınca uygula."
3. Faz bitince özeti kontrol et, `/clear` çalıştır.
4. Sıradaki session'da: "CLAUDE.md'yi oku. Faz 1'i uygula." şeklinde devam et.
5. Bir faz çok büyük gelirse ("Faz 3'ü A ve B alt adımına böl, önce A'yı yap" gibi) daha küçük parçalara ayır.

## 6. Uygulamayı Ayağa Kaldırma

### İlk kurulum (bir kez)

```bash
pnpm install
cp apps/backend/.env.example apps/backend/.env
pnpm --filter @qa-app/backend db:generate   # Prisma client üret
pnpm --filter @qa-app/backend db:push       # şemayı veritabanına yaz
pnpm --filter @qa-app/backend db:seed       # örnek veri (opsiyonel)

# Senaryo çalıştırma ve element keşfi için tarayıcılar
pnpm --filter @qa-app/e2e exec playwright install chromium firefox webkit
```

> Prisma 7 bağlantı URL'ini şemadan değil `apps/backend/prisma.config.ts` üzerinden
> okur. `apps/backend/.env` olmadan hiçbir db komutu çalışmaz.
>
> Yalnız Chromium kullanacaksan `chromium` yeterli; Firefox/WebKit seçildiğinde koşu
> "kurulu değil" mesajıyla BLOCKED olur, sessizce patlamaz.

### Geliştirme

```bash
pnpm dev            # backend (:3001) + frontend (:5173)
pnpm typecheck      # üç paketin tip kontrolü
pnpm --filter @qa-app/backend test                 # gerçek tarayıcılı doğrulama betikleri
pnpm --filter @qa-app/e2e exec playwright test     # arayüz testleri
```

Auth açıksa (aşağıya bak) e2e testleri parolayı `E2E_AUTH_PASSWORD` ile ister:

```bash
E2E_AUTH_PASSWORD=<parola> pnpm --filter @qa-app/e2e exec playwright test
```

**Windows'ta dikkat:** `pnpm dev` durdurulduğunda alt süreçler bazen hayatta kalır;
eski backend 3001'i tutar, yeni frontend 5174'e kaçar ve testler bayat sayfaya bakar.
Tuhaf hatalar alırsan önce portları kontrol et:

```powershell
Get-NetTCPConnection -LocalPort 5173,3001 -State Listen |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

### Kimlik doğrulama

`apps/backend/.env` içinde `AUTH_PASSWORD` **doluysa** uygulama takım parolası ister,
**boşsa** auth tamamen kapalıdır (yerel geliştirme kolaylığı).

```bash
AUTH_PASSWORD=uzun-ve-tahmin-edilemez-bir-parola
SESSION_SECRET=<openssl rand -hex 32 çıktısı>   # yoksa her restart'ta oturumlar düşer
```

Tek paylaşılan parola modelidir; kullanıcı bazlı yetkilendirme yoktur.

## 7. Yayına Alma (Production)

`pnpm build` iki çıktı üretir: `apps/backend/dist` (Node) ve `apps/frontend/dist`
(statik dosyalar). Backend `node dist/index.js` ile çalışır.

### Zorunlu adımlar

1. **Ortam değişkenleri** (`apps/backend/.env` ya da dağıtım ortamının kendi mekanizması):
   - `AUTH_PASSWORD` — **boş bırakılırsa uygulama herkese açık olur.**
   - `SESSION_SECRET` — tanımlı değilse her yeniden başlatmada oturumlar düşer.
   - `NODE_ENV=production` — oturum cookie'si ancak bu değerle `secure` olur.
   - `DATABASE_URL`, `PORT`.
2. **Frontend'i sunacak bir web sunucusu.** Backend statik dosya servis etmiyor ve
   arayüz API'yi `/api/*` üzerinden çağırıyor. Vite'ın proxy'si **yalnızca dev
   modunda** çalışır. Üretimde nginx/Caddy gibi bir sunucu şu eşlemeyi yapmalı:
   - `/` → `apps/frontend/dist`
   - `/api/*` → backend (ön ek düşürülerek: `/api/scenarios` → `:3001/scenarios`)
   - `/uploads/*` → backend (ekran görüntüleri)
   Aynı origin'den servis etmek şart: oturum cookie'si `sameSite: lax` ve backend'de
   `cors()` credentials'a izin vermiyor, yani ayrı domainlerde oturum taşınmaz.
3. **Playwright tarayıcıları sunucuya kurulmalı**, sistem bağımlılıklarıyla birlikte:
   `npx playwright install --with-deps chromium firefox webkit`. Kurulu değilse
   senaryo çalıştırma ve element keşfi çalışmaz.
4. **`apps/backend/uploads/` kalıcı olmalı.** Ekran görüntüleri diske yazılır;
   konteynerde efemer bir katmana denk gelirse her dağıtımda kaybolur.
5. **Tek backend örneği çalıştır.** Zamanlayıcının çalıştırma kilidi süreç içidir
   (`lib/scenario/running.ts`); iki örnek aynı senaryoyu aynı anda koşturabilir.
   Yatay ölçekleme gerekirse kilit önce veritabanına taşınmalı.

### Bilinen eksikler (yayına almadan önce karar ver)

- **Migration yok.** `prisma.config.ts` bir `prisma/migrations` yolu tanımlıyor ama
  klasör hiç oluşmadı; şema bugüne dek hep `prisma db push` ile uygulandı. Bu, üretim
  verisi için güvenli değildir (kolon silme/yeniden adlandırmada sessiz veri kaybı).
  Kalıcı bir kurulum öncesi `prisma migrate dev` ile ilk migration üretilmeli.
- **SQLite tek makineye bağlar.** Postgres'e geçişte üç yer değişir:
  `prisma/schema.prisma` içindeki `datasource provider`, `src/db.ts` içindeki
  `PrismaBetterSqlite3` adapter'ı ve `src/lib/json.ts` (SQLite dizi tutamadığı için
  `steps`/`tags` alanlarını JSON string'e çeviren yer — Postgres'te native `String[]`
  olur ve bu dosya tamamen kalkar).
- **`cors()` her origin'e açık.** Aynı origin'den servis ediliyorsa zararsız, ama
  API'yi doğrudan dışarı açacaksan daraltılmalı.
- **Kaba kuvvet koruması yok.** Girişte sabit 300 ms gecikme var; oran sınırlama yok.
- **Zamanlanmış koşular yalnız sunucu ayaktayken çalışır**, kaçanlar telafi edilmez.

