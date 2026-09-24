import { createServer, type Server } from 'node:http';

/**
 * Faz 7 testlerinin hedef sitesi. Testin kendi süreci içinde ayağa kalkar; backend'in
 * senaryo çalıştırıcısı da bu adrese bağlanır (aynı makinede olduğu için 127.0.0.1 yeterli).
 *
 * `drift` açıldığında giriş butonunun **görünen adı** değişir ama `data-testid` kalır —
 * kademeli seçici düşmenin (ilke 2) gerçek bir sayfa değişikliğiyle sınanması için.
 */
export interface DemoSite {
  url: string;
  setDrift(value: boolean): void;
  close(): Promise<void>;
}

const loginPage = (drift: boolean) => `<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><title>Demo Giriş</title></head><body>
  <h1>Demo Mağaza</h1>
  <label for="eposta">E-posta</label><input id="eposta" type="email">
  <label for="sifre">Şifre</label><input id="sifre" type="password">
  <button data-testid="giris" onclick="location.href='/panel'">${
    drift ? 'Oturum aç' : 'Giriş yap'
  }</button>
</body></html>`;

const panelPage = `<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><title>Demo Panel</title></head><body>
  <h1>Hoş geldiniz</h1>
  <p>Sipariş sayısı: 3</p>
  <button id="cikis" onclick="location.href='/'">Çıkış</button>
</body></html>`;

export async function startDemoSite(): Promise<DemoSite> {
  let drift = false;

  const server: Server = createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(req.url?.startsWith('/panel') ? panelPage : loginPage(drift));
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('Demo site adresi alınamadı');
  }

  return {
    url: `http://127.0.0.1:${address.port}/`,
    setDrift: (value) => {
      drift = value;
    },
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
