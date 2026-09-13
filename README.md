# QA App — Test Yönetim Uygulaması

Manuel test süreçlerini (test case, suite, test run) yöneten ve uygun case'leri
Playwright ile otomatize edilebilir hale getiren web uygulaması.

Geliştirme planı ve kurallar için: [`CLAUDE.md`](./CLAUDE.md)

## Teknoloji

| Katman | Seçim |
| --- | --- |
| Frontend | React 19 + TypeScript + Vite + Tailwind CSS 4 |
| Backend | Node.js + TypeScript + Express 5 |
| Veritabanı | SQLite + Prisma ORM |
| Otomasyon | Playwright (`apps/e2e`) |
| Paket yöneticisi | pnpm workspace |

## Kurulum

```bash
pnpm install
cp apps/backend/.env.example apps/backend/.env
pnpm --filter @qa-app/backend db:generate   # Prisma client üret
pnpm --filter @qa-app/backend db:push       # SQLite şemasını oluştur
pnpm --filter @qa-app/backend db:seed       # örnek veri (3 case + 1 suite)
npx playwright install chromium             # otomasyon için (bir kez)
```

> Prisma 7 bağlantı URL'ini şemadan değil `apps/backend/prisma.config.ts` üzerinden
> okur ve runtime'da `better-sqlite3` driver adapter kullanır. Bu yüzden
> `apps/backend/.env` dosyası olmadan hiçbir db komutu çalışmaz.

## Çalıştırma

```bash
pnpm dev            # backend + frontend birlikte
pnpm dev:backend    # sadece backend  → http://localhost:3001
pnpm dev:frontend   # sadece frontend → http://localhost:5173
```

Sağlık kontrolü:

```bash
curl http://localhost:3001/health
# {"status":"ok","timestamp":"..."}
```

Frontend'deki `/api/*` istekleri Vite dev sunucusu tarafından backend'e proxy'lenir.

## API

| Metot | Yol | Açıklama |
| --- | --- | --- |
| GET | `/health` | Sağlık kontrolü |
| GET | `/test-cases` | Liste — `?priority=` `?tag=` `?isAutomatable=` `?q=` |
| POST | `/test-cases` | Oluştur |
| GET | `/test-cases/:id` | Tek kayıt |
| PATCH | `/test-cases/:id` | Kısmi güncelle |
| DELETE | `/test-cases/:id` | Sil |
| GET | `/test-suites` | Liste (`caseCount` ile) |
| POST | `/test-suites` | Oluştur (opsiyonel `caseIds[]`) |
| GET | `/test-suites/:id` | Suite + sıralı case'ler |
| PATCH | `/test-suites/:id` | Kısmi güncelle |
| DELETE | `/test-suites/:id` | Sil |
| POST | `/test-suites/:id/cases` | Case ekle (`caseIds[]`, idempotent) |
| DELETE | `/test-suites/:id/cases/:caseId` | Case çıkar |
| PUT | `/test-suites/:id/cases/order` | Sırala (`caseIds[]`, tam liste) |

Hata formatı: `400` doğrulama (`details[]` ile), `404` bulunamadı, `500` sunucu hatası.

### Test run (manuel çalıştırma)

| Metot | Yol | Açıklama |
| --- | --- | --- |
| GET | `/test-runs` | Liste + durum sayaçları |
| POST | `/test-runs` | Run başlat (`suiteId`, opsiyonel `name`) — suite sırası dondurulur |
| GET | `/test-runs/:id` | Run + sıralı sonuçlar + case detayları |
| PATCH | `/test-runs/:id` | `COMPLETED` / `ABORTED` — sonrasında run salt okunur |
| DELETE | `/test-runs/:id` | Run ve ekran görüntülerini siler |
| PATCH | `/test-runs/:id/results/:caseId` | `status` ve/veya `notes` |
| POST | `/test-runs/:id/results/:caseId/run-automated` | Playwright spec'ini çalıştırır, sonucu yazar |
| POST | `/test-runs/:id/results/:caseId/screenshot` | multipart, alan adı `screenshot` |
| DELETE | `/test-runs/:id/results/:caseId/screenshot` | Görüntüyü kaldırır |

Yüklenen dosyalar `apps/backend/uploads/` altında tutulur, `/uploads/<dosya>` ile
servis edilir. Sınır: 5 MB, `image/png · jpeg · webp`. Tamamlanmış bir run'a yazma
denemeleri `409` döner.

## Ekranlar

| Route | İçerik |
| --- | --- |
| `/test-cases` | Liste + filtreler (arama, öncelik, etiket, otomasyon) |
| `/test-cases/new` · `/test-cases/:id` | Oluşturma / düzenleme formu |
| `/test-suites` | Suite listesi, satır içi oluşturma |
| `/test-suites/:id` | Suite düzenleme, case ekle / çıkar / sırala |
| `/test-runs` | Run listesi, ilerleme çubuğu ve durum sayaçları |
| `/test-runs/new` | Suite seçip run başlatma |
| `/test-runs/:id` | Çalıştırıcı: adımlar, Pass/Fail/Blocked/Skipped, not, ekran görüntüsü — kapandıktan sonra özet |

## Script'ler

| Komut | Açıklama |
| --- | --- |
| `pnpm dev` | Tüm paketleri paralel dev modunda başlatır |
| `pnpm build` | Tüm paketleri derler |
| `pnpm test` | Tüm paketlerin testlerini çalıştırır |
| `pnpm typecheck` | TypeScript tip kontrolü |

## Klasör Yapısı

```
qa-app/
├── apps/
│   ├── backend/        # Express API + Prisma
│   └── frontend/       # React + Vite arayüz
├── CLAUDE.md           # Geliştirme promptu ve faz planı
└── pnpm-workspace.yaml
```

## Durum

- [x] Faz 0 — İskelet kurulumu
- [x] Faz 1 — Veri modeli ve backend API
- [x] Faz 2 — Frontend: test case / suite yönetimi
- [x] Faz 3 — Manuel test çalıştırma
- [x] Faz 4 — Playwright otomasyon entegrasyonu
- [ ] Faz 5 — Raporlama / dashboard
- [ ] Faz 6 — Cilalama (opsiyonel)

## Otomasyon (Faz 4)

Bir test case'i `isAutomatable` işaretleyip `playwrightScriptPath` alanına
`apps/e2e` köküne göreli bir yol verin (ör. `tests/smoke/test-cases.spec.ts`).
Çalıştırıcı ekranında o case'de **Otomatik çalıştır** butonu görünür; backend
`npx playwright test <dosya> --reporter=json` komutunu `apps/e2e` içinde
çalıştırır, JSON raporundan PASS/FAIL, süre ve hata mesajını okuyup sonuca yazar.

- Yollar `apps/e2e` dizinine hapsedilir; `..` ve mutlak yollar reddedilir.
- Çalıştırma zaman aşımı 120 sn; aynı sonuç için eşzamanlı ikinci istek `409` alır.
- Tarayıcıların önceden kurulu olduğu ortamlarda `E2E_CHROMIUM_PATH` ile
  Chromium yolu verilebilir (boşsa Playwright kendi indirdiğini kullanır).
