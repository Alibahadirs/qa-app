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
```

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
- [ ] Faz 1 — Veri modeli ve backend API
- [ ] Faz 2 — Frontend: test case / suite yönetimi
- [ ] Faz 3 — Manuel test çalıştırma
- [ ] Faz 4 — Playwright otomasyon entegrasyonu
- [ ] Faz 5 — Raporlama / dashboard
- [ ] Faz 6 — Cilalama (opsiyonel)
