// Otel Bütçeleme - yerel sunucu (bağımlılık yok, sadece Node.js)
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const KOK = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(KOK, 'public');
const VERI_DIZINI = path.join(KOK, 'data');
const VERI_DOSYASI = path.join(VERI_DIZINI, 'butce.json');
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

async function kaydet(veri) {
  await fs.mkdir(YEDEK_DIZINI, { recursive: true });
  const icerik = JSON.stringify(veri, null, 2);
  // Günde bir yedek: o günün ilk kaydında önceki hali saklanır.
  const bugun = new Date().toISOString().slice(0, 10);
  const yedek = path.join(YEDEK_DIZINI, `butce-${bugun}.json`);
  try {
    await fs.access(yedek);
  } catch {
    try {
      await fs.copyFile(VERI_DOSYASI, yedek);
    } catch {
      /* henüz kayıt yok */
    }
  }
  const gecici = VERI_DOSYASI + '.tmp';
  await fs.writeFile(gecici, icerik, 'utf8');
  await fs.rename(gecici, VERI_DOSYASI);
}

async function api(req, res, yol) {
  if (yol === '/api/veri' && req.method === 'GET') {
    try {
      return gonder(res, 200, await fs.readFile(VERI_DOSYASI, 'utf8'));
    } catch {
      return gonder(res, 200, await fs.readFile(ORNEK_DOSYASI, 'utf8'));
    }
  }
  if (yol === '/api/veri' && req.method === 'PUT') {
    let veri;
    try {
      veri = JSON.parse(await govdeOku(req));
    } catch (e) {
      return gonder(res, 400, { hata: 'Geçersiz veri: ' + e.message });
    }
    if (!veri || typeof veri !== 'object' || Array.isArray(veri)) {
      return gonder(res, 400, { hata: 'Geçersiz veri' });
    }
    await kaydet(veri);
    return gonder(res, 200, { tamam: true, zaman: new Date().toISOString() });
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
  console.log(`Otel Bütçeleme çalışıyor: http://localhost:${PORT}`);
  console.log(`Veriler şu dosyaya kaydedilir: ${VERI_DOSYASI}`);
});
