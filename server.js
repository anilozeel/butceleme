// Otel Bütçeleme - yerel sunucu (bağımlılık yok, sadece Node.js)
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const KOK = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(KOK, 'public');
const VERI_DIZINI = path.join(KOK, 'data');
// Her yazılımın kendi veri dosyası vardır.
const DEPOLAR = {
  '/api/veri': 'butce.json',
  '/api/net-fiyat': 'net-fiyat.json',
};
const YEDEK_DIZINI = path.join(VERI_DIZINI, 'yedek');
const ORNEK_DOSYASI = path.join(KOK, 'ornek-veri.json');
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '127.0.0.1';

const TIPLER = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

function gonder(res, durum, govde, tip = 'application/json; charset=utf-8') {
  res.writeHead(durum, { 'Content-Type': tip, 'Cache-Control': 'no-store' });
  res.end(typeof govde === 'string' || Buffer.isBuffer(govde) ? govde : JSON.stringify(govde));
}

async function govdeOku(req, sinir = 5 * 1024 * 1024) {
  const parcalar = [];
  let boyut = 0;
  for await (const parca of req) {
    boyut += parca.length;
    if (boyut > sinir) throw new Error('Veri çok büyük');
    parcalar.push(parca);
  }
  return Buffer.concat(parcalar).toString('utf8');
}

async function kaydet(dosyaAdi, veri) {
  const dosya = path.join(VERI_DIZINI, dosyaAdi);
  await fs.mkdir(YEDEK_DIZINI, { recursive: true });
  const icerik = JSON.stringify(veri, null, 2);
  // Günde bir yedek: o günün ilk kaydında önceki hali saklanır.
  const bugun = new Date().toISOString().slice(0, 10);
  const yedek = path.join(YEDEK_DIZINI, `${path.basename(dosyaAdi, '.json')}-${bugun}.json`);
  try {
    await fs.access(yedek);
  } catch {
    try {
      await fs.copyFile(dosya, yedek);
    } catch {
      /* henüz kayıt yok */
    }
  }
  const gecici = dosya + '.tmp';
  await fs.writeFile(gecici, icerik, 'utf8');
  await fs.rename(gecici, dosya);
}

async function api(req, res, yol) {
  const dosyaAdi = DEPOLAR[yol];
  if (dosyaAdi && req.method === 'GET') {
    try {
      return gonder(res, 200, await fs.readFile(path.join(VERI_DIZINI, dosyaAdi), 'utf8'));
    } catch {
      return gonder(res, 200, {}); // ilk açılış: boş veri
    }
  }
  if (dosyaAdi && req.method === 'PUT') {
    let veri;
    try {
      veri = JSON.parse(await govdeOku(req));
    } catch (e) {
      return gonder(res, 400, { hata: 'Geçersiz veri: ' + e.message });
    }
    if (!veri || typeof veri !== 'object' || Array.isArray(veri)) {
      return gonder(res, 400, { hata: 'Geçersiz veri' });
    }
    await kaydet(dosyaAdi, veri);
    return gonder(res, 200, { tamam: true, zaman: new Date().toISOString() });
  }
  if (yol === '/api/kur' && req.method === 'GET') {
    // TCMB günlük kurları (internet bağlantısı gerekir)
    try {
      const yanit = await fetch('https://www.tcmb.gov.tr/kurlar/today.xml', { signal: AbortSignal.timeout(8000) });
      if (!yanit.ok) throw new Error(`TCMB ${yanit.status}`);
      return gonder(res, 200, await yanit.text(), 'application/xml; charset=utf-8');
    } catch (e) {
      return gonder(res, 502, { hata: 'TCMB kurlarına ulaşılamadı: ' + e.message });
    }
  }
  if (yol === '/api/ornek' && req.method === 'GET') {
    return gonder(res, 200, await fs.readFile(ORNEK_DOSYASI, 'utf8'));
  }
  return gonder(res, 404, { hata: 'Bulunamadı' });
}

async function statik(res, yol) {
  const dosya = path.normalize(path.join(PUBLIC, yol === '/' ? 'index.html' : yol));
  if (!dosya.startsWith(PUBLIC + path.sep)) return gonder(res, 403, 'Yasak', 'text/plain');
  try {
    const icerik = await fs.readFile(dosya);
    return gonder(res, 200, icerik, TIPLER[path.extname(dosya)] || 'application/octet-stream');
  } catch {
    return gonder(res, 404, 'Bulunamadı', 'text/plain; charset=utf-8');
  }
}

const sunucu = http.createServer(async (req, res) => {
  try {
    const yol = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (yol.startsWith('/api/')) return await api(req, res, yol);
    return await statik(res, yol);
  } catch (e) {
    console.error(e);
    gonder(res, 500, { hata: 'Sunucu hatası' });
  }
});

sunucu.listen(PORT, HOST, () => {
  console.log(`Otel Bütçeleme çalışıyor:  http://localhost:${PORT}`);
  console.log(`Net Oda Fiyatı hesaplama: http://localhost:${PORT}/net-fiyat.html`);
  console.log(`Veriler şu klasöre kaydedilir: ${VERI_DIZINI}`);
});
