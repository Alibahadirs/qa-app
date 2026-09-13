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
| Otomasyon | Playwright (Faz 4) |
| Paket yöneticisi | pnpm workspace |

## Kurulum

```bash
pnpm install
cp apps/backend/.env.example apps/backend/.env
pnpm --filter @qa-app/backend db:generate   # Prisma client üret
pnpm --filter @qa-app/backend db:push       # SQLite şemasını oluştur
pnpm --filter @qa-app/backend db:seed       # örnek veri (3 case + 1 suite)
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

`TestRun` ve `TestResult` modelleri şemada tanımlı; endpoint'leri Faz 3'te eklenecek.

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
- [ ] Faz 2 — Frontend: test case / suite yönetimi
- [ ] Faz 3 — Manuel test çalıştırma
- [ ] Faz 4 — Playwright otomasyon entegrasyonu
- [ ] Faz 5 — Raporlama / dashboard
- [ ] Faz 6 — Cilalama (opsiyonel)
