import {
  hesapla, bosVeri, KATEGORILER, GIDER_TIPLERI, DUYARLILIK_FIYAT, DUYARLILIK_DOLULUK,
  AYLAR, aylikVarMi, donem, yilaTasi,
} from './calc.js';

let veri = bosVeri();
let sonuc = hesapla(veri);
let aktifSekme = null;
try {
  aktifSekme = localStorage.getItem('aktifSekme');
} catch { /* depolama kapalı olabilir */ }

// ---------------- Biçimlendirme ----------------
const nf0 = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pb = () => veri.otel?.paraBirimi || '₺';
const gecerli = (x) => x !== null && x !== undefined && Number.isFinite(x);
const para = (x) => (gecerli(x) ? `${nf0.format(Math.round(x))} ${pb()}` : '—');
const yz = (x) => (gecerli(x) ? `%${nf1.format(x * 100)}` : '—');
const degisim = (a, b) => {
  if (!gecerli(a) || !gecerli(b) || a === 0) return '—';
  const d = (b - a) / Math.abs(a);
  return `<span class="${d >= 0 ? 'pozitif' : 'negatif'}">${d >= 0 ? '▲' : '▼'} %${nf1.format(Math.abs(d) * 100)}</span>`;
};
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const yeniId = () => Math.random().toString(36).slice(2, 10);

// Kişi sayısı: ortalamalar küsuratlı olabilir (ör. 12,5 kişi).
const kisiBicim = (x) => (!gecerli(x) ? '—' : Math.abs(x - Math.round(x)) < 0.05 ? nf0.format(Math.round(x)) : nf1.format(x));
const tarihBicim = (t) => (t ? t.split('-').reverse().join('.') : '');
const ayBaslik = (i, oran) => `${AYLAR[i]}<span class="yil">${oran < 1 ? `${Math.round(oran * 30)} gün` : 'tam ay'}</span>`;

const BICIMLER = {
  kisi: kisiBicim,
  para,
  yuzde: yz,
  sayi0: (x) => (gecerli(x) ? nf0.format(Math.round(x)) : '—'),
  sayi1: (x) => (gecerli(x) ? nf1.format(x) : '—'),
  sayi2: (x) => (gecerli(x) ? nf2.format(x) : '—'),
  zam: (x) => (gecerli(x) ? `%${nf1.format(x)}` : '—'),
};

// ---------------- Yol (path) yardımcıları ----------------
function yolOku(nesne, yol) {
  return yol.split('.').reduce((o, k) => (o == null ? undefined : o[k]), nesne);
}
function yolYaz(nesne, yol, deger) {
  const parcalar = yol.split('.');
  const son = parcalar.pop();
  let o = nesne;
  for (const k of parcalar) {
    const sonrakiSayi = /^\d+$/.test(parcalar[parcalar.indexOf(k) + 1] ?? son);
    if (o[k] == null) o[k] = sonrakiSayi ? [] : {};
    o = o[k];
  }
  o[son] = deger;
}

// ---------------- Girdi bileşenleri ----------------
function sayiGirdi(yol, o = {}) {
  const deger = yolOku(veri, yol);
  return `<input type="number" step="any" data-yol="${esc(yol)}" data-tip="sayi"
    class="${o.cls || ''}" value="${esc(deger ?? '')}" placeholder="${esc(o.ph ?? '')}"
    ${o.min !== undefined ? `min="${o.min}"` : ''} ${o.max !== undefined ? `max="${o.max}"` : ''}
    aria-label="${esc(o.etiket || yol)}"${o.yeniden ? ' data-yeniden="1"' : ''}${o.phEnf ? ' data-ph-enf="1"' : ''}>`;
}
function metinGirdi(yol, o = {}) {
  const deger = yolOku(veri, yol);
  return `<input type="text" data-yol="${esc(yol)}" data-tip="metin" class="${o.cls || ''}"
    value="${esc(deger ?? '')}" placeholder="${esc(o.ph ?? '')}" aria-label="${esc(o.etiket || yol)}"${o.yeniden ? ' data-yeniden="1"' : ''}>`;
}
function tarihGirdi(yol, o = {}) {
  const deger = yolOku(veri, yol);
  return `<input type="date" data-yol="${esc(yol)}" data-tip="metin" data-yeniden="1" value="${esc(deger ?? '')}" aria-label="${esc(o.etiket || yol)}">`;
}
function secim(yol, secenekler, o = {}) {
  const deger = yolOku(veri, yol);
  const ops = Object.entries(secenekler)
    .map(([k, ad]) => `<option value="${esc(k)}"${k === deger ? ' selected' : ''}>${esc(ad)}</option>`)
    .join('');
  return `<select data-yol="${esc(yol)}" data-tip="metin" aria-label="${esc(o.etiket || yol)}"${o.yeniden ? ' data-yeniden="1"' : ''}>${ops}</select>`;
}
function kutu(yol, o = {}) {
  const deger = yolOku(veri, yol);
  return `<input type="checkbox" data-yol="${esc(yol)}" data-tip="kutu" ${deger ? 'checked' : ''} aria-label="${esc(o.etiket || yol)}"${o.yeniden ? ' data-yeniden="1"' : ''}>`;
}
const cikti = (yol, bicim = 'para', cls = '') => `<td class="cikti ${cls}" data-cikti="${yol}" data-bicim="${bicim}"></td>`;
const fnAlan = (ad, etiket = 'div', cls = '') => `<${etiket} class="${cls}" data-fn="${ad}"></${etiket}>`;
const silDugme = (liste, i) => `<button type="button" class="sil" data-sil="${liste}" data-index="${i}" title="Satırı sil" aria-label="Satırı sil">✕</button>`;

// ---------------- Canlı hesaplanan alanlar ----------------
const FN = {
  kpiSerit: (s) => {
    const kpi = (etiket, deger, fark = '') =>
      `<div class="kpi"><div class="etiket">${etiket}</div><div class="deger">${deger}</div><div class="fark">${fark}</div></div>`;
    return [
      kpi('2027 Toplam Gelir', para(s.gelir27), `2026: ${para(s.gelir26)} ${degisim(s.gelir26, s.gelir27)}`),
      kpi('2027 Toplam Gider', para(s.toplamGider27), `2026: ${para(s.toplamGider26)} ${degisim(s.toplamGider26, s.toplamGider27)}`),
      kpi('2027 Vergi Öncesi Kâr', `<span class="${s.kar27 < 0 ? 'negatif' : ''}">${para(s.kar27)}</span>`, `Marj ${yz(s.marj27)} (2026: ${yz(s.marj26)})`),
      kpi('2027 Ort. Oda Fiyatı (ADR)', para(s.oda.adr27), `2026: ${para(s.oda.adr26)} ${degisim(s.oda.adr26, s.oda.adr27)}`),
      kpi('2027 Doluluk', yz(s.oda.doluluk27), `2026: ${yz(s.oda.doluluk26)}`),
      kpi('2027 Personel (ort.)', `${kisiBicim(s.personelOzet.kisi27)} kişi`, `En yoğun ay ${kisiBicim(s.personelOzet.zirve27)} · 2026 ort. ${kisiBicim(s.personelOzet.kisi26)}`),
    ].join('');
  },

  ozet: (s) => ozetHtml(s),

  departmanlar: (s) => {
    if (!s.departmanlar.length) return '<p class="bos">Henüz personel eklenmedi.</p>';
    const fark = (a, b) => `${b - a > 0.05 ? '+' : ''}${kisiBicim(b - a)}`;
    const satirlar = s.departmanlar.map((d) => `<tr>
      <td class="sol">${esc(d.ad)}</td>
      <td>${kisiBicim(d.kisi26)}</td><td>${kisiBicim(d.kisi27)}</td><td>${fark(d.kisi26, d.kisi27)}</td>
      <td>${para(d.maliyet26)}</td><td>${para(d.maliyet27)}</td><td>${degisim(d.maliyet26, d.maliyet27)}</td></tr>`).join('');
    const p = s.personelOzet;
    return `<div class="kaydir"><table class="tablo">
      <thead><tr><th class="sol">Departman</th><th>Ort. Kişi<span class="yil">2026</span></th><th>Ort. Kişi<span class="yil">2027</span></th><th>Fark</th>
      <th>Maliyet<span class="yil">2026</span></th><th>Maliyet<span class="yil">2027</span></th><th>Değişim</th></tr></thead>
      <tbody>${satirlar}
      <tr class="toplam"><td class="sol">Toplam</td><td>${kisiBicim(p.kisi26)}</td><td>${kisiBicim(p.kisi27)}</td><td>${fark(p.kisi26, p.kisi27)}</td>
      <td>${para(p.maliyet26)}</td><td>${para(p.maliyet27)}</td><td>${degisim(p.maliyet26, p.maliyet27)}</td></tr></tbody>
    </table></div>
    <p class="ipucu">Ort. kişi = açık aylardaki ortalama. Oda başına personel: 2026 ${nf2.format(s.personelOdaOrani26)} → 2027 ${nf2.format(s.personelOdaOrani27)} ·
      Personel maliyetinin gelire oranı: 2026 ${yz(s.personelOrani26)} → 2027 ${yz(s.personelOrani27)}</p>`;
  },

  aylikPersonel: (s) => {
    const aylar = [...new Set([...s.donem26.aylar, ...s.donem27.aylar])].sort((a, b) => a - b);
    if (!s.departmanlar.length) return '<p class="bos">Henüz personel eklenmedi.</p>';
    const hucre = (a26, a27) => `<td>${kisiBicim(a27)}<span class="yil">2026: ${kisiBicim(a26)}</span></td>`;
    const satirlar = s.departmanlar.map((d) => `<tr><td class="sol">${esc(d.ad)}</td>
      ${aylar.map((i) => hucre(d.aylik26[i], d.aylik27[i])).join('')}</tr>`).join('');
    const p = s.personelOzet;
    return `<div class="kaydir"><table class="tablo aylik-ozet">
      <thead><tr><th class="sol">Departman</th>${aylar.map((i) => `<th>${AYLAR[i]}</th>`).join('')}</tr></thead>
      <tbody>${satirlar}<tr class="toplam"><td class="sol">Toplam 2027</td>${aylar.map((i) => hucre(p.aylik26[i], p.aylik27[i])).join('')}</tr></tbody>
    </table></div>`;
  },

  adrDegisim: (s) => degisim(s.oda.adr26, s.oda.adr27),
  odaGelirDegisim: (s) => degisim(s.oda.gelir26, s.oda.gelir27),

  donemBilgi: (s) => {
    const d = s.donem26;
    return d.sezon
      ? `Açık gün: <strong>${nf0.format(d.gun)}</strong> (${tarihBicim(d.bas)} – ${tarihBicim(d.bit)})`
      : `Açık gün: <strong>${nf0.format(d.gun)}</strong>`;
  },

  donemBilgi27: (s) => {
    const d = s.donem27;
    return d.sezon
      ? `2027 açık gün: <strong>${nf0.format(d.gun)}</strong> (${tarihBicim(d.bas)} – ${tarihBicim(d.bit)})`
      : `2027 açık gün: <strong>${nf0.format(d.gun)}</strong>`;
  },

  kisiOneri: (s) => {
    const oran = s.hacimOrani;
    return `Satılan oda gecelemesi 2027'de <strong>${degisim(1, oran)}</strong> değişiyor.
      Ay kutusu boş bırakılırsa 2026'daki aynı ayın kişi sayısı kullanılır (gri rakam); "Doluluğa bağlı" satırlarda bu oranda artırılır.`;
  },

  hedefKartlar: (s) => {
    const h = s.hedef;
    const kart = (etiket, deger, alt, vurgulu = false) =>
      `<div class="kpi-kart${vurgulu ? ' vurgulu' : ''}"><div class="etiket">${etiket}</div><div class="deger">${deger}</div><div class="fark">${alt}</div></div>`;
    return `<div class="kpi-izgara">
      ${kart('Planlanan 2027 ort. oda fiyatı', para(s.oda.adr27), `2026: ${para(s.oda.adr26)}`)}
      ${kart('Başa baş oda fiyatı (kâr = 0)', para(h.basaBasAdr), 'Planlanan doluluk ile')}
      ${kart(`%${nf1.format(h.marj * 100)} kâr marjı için gereken fiyat`, para(h.hedefAdr), 'Planlanan doluluk ile', true)}
      ${kart('Başa baş doluluk', h.basaBasDoluluk === null ? 'Ulaşılamıyor' : yz(h.basaBasDoluluk), 'Planlanan fiyatlar ile')}
    </div>`;
  },

  hedefMesaj: (s) => {
    const h = s.hedef;
    if (h.hedefCarpan === null) {
      return '<div class="mesaj kotu">⚠ Bu kâr marjı hedefine, gelire bağlı giderler (komisyon, vergi) nedeniyle fiyat artışıyla ulaşılamıyor. Marjı düşürün veya oranları gözden geçirin.</div>';
    }
    const fark = h.hedefCarpan - 1;
    if (Math.abs(fark) < 0.0005) return '<div class="mesaj iyi">✓ Planlanan fiyatlar hedef kâr marjını tam karşılıyor.</div>';
    if (fark > 0) {
      return `<div class="mesaj kotu">▲ Hedef marja ulaşmak için planlanan 2027 oda fiyatlarına <strong>ek %${nf1.format(fark * 100)}</strong> zam gerekiyor
        (2026'ya göre toplam ~%${nf1.format(((s.oda.adr27 * h.hedefCarpan) / s.oda.adr26 - 1) * 100)}).</div>`;
    }
    return `<div class="mesaj iyi">✓ Planlanan fiyatlar hedefin üzerinde. Fiyatlar <strong>%${nf1.format(-fark * 100)}</strong> daha düşük olsa bile hedef marj korunur.</div>`;
  },

  hedefOdalar: (s) => {
    if (!s.odalar.length) return '<p class="bos">Oda tipi eklenmedi.</p>';
    return `<div class="kaydir"><table class="tablo"><thead><tr>
      <th class="sol">Oda Tipi</th><th>Adet</th><th>Fiyat<span class="yil">2026</span></th><th>Planlanan<span class="yil">2027</span></th>
      <th>Hedef marj için<span class="yil">2027</span></th><th>2026'ya göre zam</th></tr></thead><tbody>
      ${s.odalar.map((o, i) => `<tr><td class="sol">${esc(o.ad || '')}</td><td>${nf0.format(o.adet)}</td>
        <td>${para(o.fiyat26)}</td><td>${para(o.fiyat27)}</td><td><strong>${para(s.hedef.odaFiyatlari[i].hedef27)}</strong></td>
        <td>${degisim(o.fiyat26, s.hedef.odaFiyatlari[i].hedef27)}</td></tr>`).join('')}
    </tbody></table></div>`;
  },

  duyarlilik: (s) => {
    const baslik = DUYARLILIK_FIYAT.map((f) => `<th>${f > 0 ? '+' : ''}${f === 0 ? 'Plan' : `%${f}`}</th>`).join('');
    const satirlar = DUYARLILIK_DOLULUK.map((d, i) => `<tr><th class="sol">${d === 0 ? 'Plan' : `${d > 0 ? '+' : ''}${d} puan`}
        <span class="yil">${yz(Math.min(1, Math.max(0, s.oda.doluluk27 + d / 100)))}</span></th>
      ${DUYARLILIK_FIYAT.map((f, j) => {
        const k = s.duyarlilik[i][j];
        const cls = [d === 0 && f === 0 ? 'merkez' : '', k < 0 ? 'zarar' : ''].join(' ');
        return `<td class="${cls}">${k < 0 ? '−' : ''}${para(Math.abs(k))}</td>`;
      }).join('')}</tr>`).join('');
    return `<div class="kaydir"><table class="tablo duyarlilik"><thead><tr><th class="sol">Doluluk ↓ / Fiyat →</th>${baslik}</tr></thead>
      <tbody>${satirlar}</tbody></table></div>`;
  },
};

// ---------------- Sekmeler ----------------
// Akış: 1) 2026'da gerçekleşeni gir → 2) 2027 için karar ver → 3) sonucu gör.
const SIRA = [
  { id: 'v26-odalar', grup: '1 · 2026 Verileri', ad: 'Odalar & Gelirler' },
  { id: 'v26-personel', grup: '1 · 2026 Verileri', ad: 'Personel' },
  { id: 'v26-giderler', grup: '1 · 2026 Verileri', ad: 'Giderler' },
  { id: 'k27-genel', grup: '2 · 2027 Kararları', ad: 'Genel Zamlar' },
  { id: 'k27-odalar', grup: '2 · 2027 Kararları', ad: 'Oda Fiyatı & Doluluk' },
  { id: 'k27-personel', grup: '2 · 2027 Kararları', ad: 'Personel & Maaş' },
  { id: 'k27-giderler', grup: '2 · 2027 Kararları', ad: 'Gider Zamları' },
  { id: 'ozet', grup: '3 · Sonuç', ad: 'Özet' },
  { id: 'hedef', grup: '3 · Sonuç', ad: 'Fiyat Hedefi & Senaryo' },
];

const ro = (icerik, cls = '') => `<td class="salt ${cls}">${icerik}</td>`;
const roPara = (x) => ro(gecerli(Number(x)) && x !== '' ? para(Number(x)) : '—');
const roYz = (x) => ro(x === '' || x == null ? '—' : `%${nf1.format(Number(x))}`);
const roAd = (x, yedek) => ro(esc(x || yedek), 'sol');
const alan = (etiket, girdi, ipucu = '') =>
  `<div class="alan"><label>${etiket}</label>${girdi}${ipucu ? `<p class="ipucu">${ipucu}</p>` : ''}</div>`;
const zamPh = (x) => `%${x === '' || x == null ? 0 : x}`;
const TIP_KISA = { sabit: 'Sabit', degisken: 'Değişken', gelirYuzdesi: 'Gelirin %\'si' };

function giderKategorileri() {
  const kategoriler = [...KATEGORILER];
  veri.giderler.forEach((g) => { if (g.kategori && !kategoriler.includes(g.kategori)) kategoriler.push(g.kategori); });
  return kategoriler;
}

// ---------------- Oda satışı girişi (toplam / oda tipi) ----------------
const odaVarMi = () => (veri.odaGiris === 'toplam' ? !!Number(veri.odaToplam?.adet) : veri.odalar.length > 0);
function odaGirisSecimi() {
  return `<section class="kart">
      <h2>Oda Satışlarını Nasıl Gireceksiniz?</h2>
      <div class="form-izgara">
        ${alan('Giriş şekli', secim('odaGiris', { toplam: 'Toplam (otelin tamamı)', tip: 'Oda tiplerine göre' }, { yeniden: true, etiket: 'Oda giriş şekli' }),
          'Toplam: dönemde satılan oda-gece ve oda gelirini tek rakam olarak girersiniz.')}
      </div>
    </section>`;
}

function toplamOda26() {
  const d = sonuc.donem26;
  return `<section class="kart">
      <h2>2026 Toplam Oda Satışı</h2>
      <p class="aciklama">${d.sezon ? `Sezon dönemi (${tarihBicim(d.bas)} – ${tarihBicim(d.bit)}, ${d.gun} gün)` : `Yıl (${d.gun} açık gün)`} boyunca
        otelin toplamında gerçekleşen satışları girin. Oda geliri KDV hariç, kahvaltı/pansiyon dahil oda başı satış tutarının toplamıdır.</p>
      <div class="form-izgara">
        ${alan('Oda sayısı', sayiGirdi('odaToplam.adet', { min: 0 }))}
        ${alan('Toplam satılan oda (oda-gece)', sayiGirdi('odaToplam.satilan2026', { min: 0 }), 'Dönem boyunca satılan toplam oda-gece sayısı.')}
        ${alan(`Toplam oda geliri (${esc(pb())})`, sayiGirdi('odaToplam.gelir2026', { min: 0 }))}
      </div>
      <div class="kpi-izgara" style="margin-top:16px">
        <div class="kpi-kart"><div class="etiket">Ortalama oda fiyatı (ADR)</div><div class="deger" data-cikti="oda.adr26" data-bicim="para"></div></div>
        <div class="kpi-kart"><div class="etiket">Doluluk</div><div class="deger" data-cikti="oda.doluluk26" data-bicim="yuzde"></div></div>
        <div class="kpi-kart"><div class="etiket">Satılabilir oda-gece</div><div class="deger" data-cikti="oda.kapasite26" data-bicim="sayi0"></div></div>
        <div class="kpi-kart"><div class="etiket">RevPAR</div><div class="deger" data-cikti="oda.revpar26" data-bicim="para"></div></div>
      </div>
    </section>`;
}

function toplamOda27(v) {
  const t = veri.odaToplam || {};
  const d = sonuc.donem27;
  return `<section class="kart">
      <h2>2027 Oda Fiyatı ve Satış Kararları</h2>
      <p class="aciklama">${d.sezon ? `2027 sezonu (${tarihBicim(d.bas)} – ${tarihBicim(d.bit)}, ${d.gun} gün)` : `2027 (${d.gun} açık gün)`}.
        Satış hedefi boş bırakılırsa 2026 doluluğu korunur. Fiyat zammı boşsa genel oda fiyatı zammı (${zamPh(v.odaFiyatZam)}) kullanılır.</p>
      ${t.adet ? '' : '<div class="mesaj">Önce <strong>1 · 2026 Verileri → Odalar &amp; Gelirler</strong> sekmesinde toplam oda satışını girin.</div>'}
      <div class="form-izgara">
        ${alan('2027 oda sayısı', sayiGirdi('odaToplam.adet2027', { min: 0, ph: `2026 ile aynı (${t.adet || 0})` }))}
        ${alan('Oda fiyatı zammı (%)', sayiGirdi('odaToplam.fiyatZam', { ph: zamPh(v.odaFiyatZam) }), '2026 ortalama oda fiyatına göre.')}
        ${alan('2027 satılan oda hedefi (oda-gece)', sayiGirdi('odaToplam.satilan2027', { min: 0, ph: kisiBicim(sonuc.oda.kapasite27 * sonuc.oda.doluluk26) }),
          'Boşsa 2026 doluluğuyla hesaplanan sayı (gri).')}
      </div>
      <div class="kaydir" style="margin-top:16px"><table class="tablo">
        <thead><tr><th class="sol">Gösterge</th><th>2026</th><th>2027</th><th>Değişim</th></tr></thead>
        <tbody>
          <tr><td class="sol">Ortalama oda fiyatı (ADR)</td>${cikti('oda.adr26')}${cikti('oda.adr27', 'para', 'vurgu')}<td data-fn="adrDegisim"></td></tr>
          <tr><td class="sol">Satılan oda-gece</td>${cikti('oda.satilan26', 'sayi0')}${cikti('oda.satilan27', 'sayi0')}<td></td></tr>
          <tr><td class="sol">Doluluk</td>${cikti('oda.doluluk26', 'yuzde')}${cikti('oda.doluluk27', 'yuzde')}<td></td></tr>
          <tr><td class="sol">Oda geliri</td>${cikti('oda.gelir26')}${cikti('oda.gelir27', 'para', 'vurgu')}<td data-fn="odaGelirDegisim"></td></tr>
          <tr><td class="sol">RevPAR</td>${cikti('oda.revpar26')}${cikti('oda.revpar27')}<td></td></tr>
        </tbody>
      </table></div>
      <p class="ipucu">Zarar etmemek için gereken fiyatı <strong>3 · Sonuç → Fiyat Hedefi</strong> sekmesinde görebilirsiniz.</p>
    </section>`;
}

function tipOda26(satirlar) {
  return `    <section class="kart">
      <h2>2026 Oda Satışları</h2>
      <p class="aciklama">Her oda tipi için 2026 yılında gerçekleşen (veya yıl sonu tahmini) ortalama gecelik satış fiyatını (KDV hariç) ve doluluğu girin.</p>
      <div class="kaydir"><table class="tablo">
        <thead><tr><th class="sol">Oda Tipi</th><th>Oda Adedi</th><th>Ort. Satış Fiyatı<span class="yil">2026</span></th>
          <th>Doluluk %<span class="yil">2026</span></th><th>Satılan Oda-Gece<span class="yil">2026</span></th><th>Oda Geliri<span class="yil">2026</span></th><th></th></tr></thead>
        <tbody>${satirlar || '<tr><td class="sol bos" colspan="7">Henüz oda tipi yok. Aşağıdan ekleyin.</td></tr>'}
          <tr class="toplam"><td class="sol">Toplam</td>${cikti('oda.adet', 'sayi0')}${cikti('oda.adr26')}${cikti('oda.doluluk26', 'yuzde')}
            ${cikti('oda.satilan26', 'sayi0')}${cikti('oda.gelir26')}<td></td></tr>
        </tbody>
      </table></div>
      <button type="button" class="ekle" data-ekle="odalar">+ Oda tipi ekle</button>
    </section>`;
}

function tipOda27(satirlar, v) {
  return `    <section class="kart">
      <h2>2027 Oda Fiyatı ve Doluluk Kararları</h2>
      <p class="aciklama">Her oda tipi için 2027 fiyat zammını ve hedef doluluğu belirleyin. Boş bırakılan zam kutusu genel oda fiyatı
        zammını (${zamPh(v.odaFiyatZam)}), boş doluluk 2026 doluluğunu kullanır. Oda sayısı değişmiyorsa "2027 adet" boş kalabilir.</p>
      ${veri.odalar.length ? '' : '<div class="mesaj">Önce <strong>1 · 2026 Verileri → Odalar &amp; Gelirler</strong> sekmesinde oda tiplerini girin.</div>'}
      <div class="kaydir"><table class="tablo">
        <thead><tr><th class="sol">Oda Tipi</th><th>Adet<span class="yil">2026</span></th><th>Adet<span class="yil">2027</span></th>
          <th>Ort. Fiyat<span class="yil">2026</span></th><th>Fiyat Zammı %<span class="yil">2027</span></th><th>Ort. Fiyat<span class="yil">2027</span></th>
          <th>Doluluk<span class="yil">2026</span></th><th>Doluluk % Hedefi<span class="yil">2027</span></th>
          <th>Satılan Oda-Gece<span class="yil">2027</span></th><th>Oda Geliri<span class="yil">2026</span></th><th>Oda Geliri<span class="yil">2027</span></th></tr></thead>
        <tbody>${satirlar}
          <tr class="toplam"><td class="sol">Toplam</td>${cikti('oda.adet', 'sayi0')}${cikti('oda.adet27', 'sayi0')}${cikti('oda.adr26')}<td></td>
            ${cikti('oda.adr27')}${cikti('oda.doluluk26', 'yuzde')}${cikti('oda.doluluk27', 'yuzde')}${cikti('oda.satilan27', 'sayi0')}
            ${cikti('oda.gelir26')}${cikti('oda.gelir27')}</tr>
        </tbody>
      </table></div>
      <p class="ipucu">RevPAR (müsait oda başına gelir): 2026 <span data-cikti="oda.revpar26" data-bicim="para"></span> → 2027 <span data-cikti="oda.revpar27" data-bicim="para"></span>.
        Zarar etmemek için gereken fiyatı <strong>3 · Sonuç → Fiyat Hedefi</strong> sekmesinde görebilirsiniz.</p>
    </section>`;
}

const SEKMELER = {
  // ======================= 1 · 2026 VERİLERİ =======================
  'v26-odalar': () => {
    const satirlar = veri.odalar.map((o, i) => `<tr>
      <td class="sol girdi">${metinGirdi(`odalar.${i}.ad`, { ph: 'Oda tipi', etiket: 'Oda tipi' })}</td>
      <td class="girdi">${sayiGirdi(`odalar.${i}.adet`, { cls: 'kisa', min: 0, etiket: 'Oda adedi' })}</td>
      <td class="girdi">${sayiGirdi(`odalar.${i}.fiyat2026`, { min: 0, etiket: '2026 ortalama fiyat' })}</td>
      <td class="girdi">${sayiGirdi(`odalar.${i}.doluluk2026`, { cls: 'kisa', min: 0, max: 100, etiket: '2026 doluluk' })}</td>
      ${cikti(`odalar.${i}.satilan26`, 'sayi0')}${cikti(`odalar.${i}.gelir26`)}
      <td>${silDugme('odalar', i)}</td></tr>`).join('');
    const gelirSatirlari = veri.digerGelirler.map((g, i) => `<tr>
      <td class="sol girdi">${metinGirdi(`digerGelirler.${i}.ad`, { cls: 'uzun', ph: 'Gelir kalemi', etiket: 'Gelir kalemi' })}</td>
      <td class="girdi">${sayiGirdi(`digerGelirler.${i}.tutar2026`, { min: 0, etiket: '2026 tutar' })}</td>
      <td class="sol girdi">${secim(`digerGelirler.${i}.tip`, { sabit: 'Sabit', degisken: 'Dolulukla değişir' }, { etiket: 'Tip' })}</td>
      <td>${silDugme('digerGelirler', i)}</td></tr>`).join('');
    return `
    <section class="kart">
      <h2>Otel Bilgileri</h2>
      <div class="form-izgara">
        ${alan('Otel adı', metinGirdi('otel.ad', { cls: 'uzun' }))}
        ${alan('Para birimi', metinGirdi('otel.paraBirimi', { cls: 'kisa' }))}
        ${alan('Çalışma şekli', secim('otel.calismaSekli', { yil: 'Yıl boyu açık', sezon: 'Sezonluk (tarih aralığı)' }, { yeniden: true, etiket: 'Çalışma şekli' }))}
        ${veri.otel.calismaSekli === 'sezon'
          ? `${alan('2026 sezon açılışı', tarihGirdi('otel.sezon2026Bas'))}
             ${alan('2026 sezon kapanışı', tarihGirdi('otel.sezon2026Bit'), fnAlan('donemBilgi', 'span'))}`
          : alan('2026 açık gün sayısı', sayiGirdi('otel.acikGun2026', { min: 0, max: 366 }), fnAlan('donemBilgi', 'span'))}
      </div>
    </section>
    ${odaGirisSecimi()}
    ${veri.odaGiris === 'toplam' ? toplamOda26() : tipOda26(satirlar)}
    <section class="kart">
      <h2>2026 Diğer Gelirler</h2>
      <p class="aciklama">Yiyecek-içecek, SPA, toplantı gibi oda dışı gelirlerin 2026 yıllık tutarı.
        "Dolulukla değişir" seçilenler 2027'de satılan oda sayısıyla orantılı değişir.</p>
      <div class="kaydir"><table class="tablo">
        <thead><tr><th class="sol">Gelir Kalemi</th><th>Yıllık Tutar<span class="yil">2026</span></th><th class="sol">Nasıl değişir?</th><th></th></tr></thead>
        <tbody>${gelirSatirlari || '<tr><td class="sol bos" colspan="4">Henüz gelir kalemi yok.</td></tr>'}
          <tr class="toplam"><td class="sol">Toplam</td>${cikti('digerGelir26')}<td></td><td></td></tr>
        </tbody>
      </table></div>
      <button type="button" class="ekle" data-ekle="digerGelirler">+ Gelir kalemi ekle</button>
    </section>`;
  },

  'v26-personel': () => {
    const d = sonuc.donem26;
    const satirlar = veri.personel.map((p, i) => `<tr>
      <td class="sol girdi">${metinGirdi(`personel.${i}.departman`, { ph: 'Departman', etiket: 'Departman' })}</td>
      <td class="sol girdi">${metinGirdi(`personel.${i}.pozisyon`, { ph: 'Pozisyon', etiket: 'Pozisyon' })}</td>
      <td class="girdi"><input type="number" class="ay-girdi doldur" min="0" data-doldur="personel.${i}.aylik2026" data-yil="2026"
        placeholder="→" aria-label="Tüm aylara aynı kişi sayısını yaz" title="Tüm aylara aynı sayıyı yaz"></td>
      ${d.aylar.map((m) => `<td class="girdi">${sayiGirdi(`personel.${i}.aylik2026.${m}`, {
        cls: 'ay-girdi', min: 0, etiket: `${AYLAR[m]} 2026 kişi`,
        ph: sonuc.personel[i]?.eskiTip ? '' : '0' })}</td>`).join('')}
      ${cikti(`personel.${i}.kisi26`, 'kisi')}
      <td class="girdi">${sayiGirdi(`personel.${i}.maas2026`, { min: 0, etiket: 'Güncel brüt maaş' })}</td>
      <td class="girdi">${sayiGirdi(`personel.${i}.yanHak`, { min: 0, ph: '0', etiket: 'Aylık yan hak' })}</td>
      ${cikti(`personel.${i}.maliyet26`)}
      <td>${silDugme('personel', i)}</td></tr>`).join('');
    return `
    <section class="kart">
      <h2>2026 Personel ve Maaşlar</h2>
      <p class="aciklama">Her pozisyonda <strong>her ay kaç kişi çalıştığını</strong> girin. Aynı sayı her ay geçerliyse ilk kutuya (→) yazın, tüm aylara dağıtılır.
        Maaş: güncel <strong>brüt</strong> aylık maaş. Yemek, servis, lojman gibi yan hakları kişi başı aylık tutar olarak yazın.
        ${d.sezon ? `Sezon ${tarihBicim(d.bas)} – ${tarihBicim(d.bit)}: kısmi aylarda maaş çalışılan gün / 30 oranında hesaplanır.` : ''}</p>
      <div class="form-izgara" style="margin-bottom:12px">
        ${alan('SGK işveren payı (%)', sayiGirdi('varsayimlar.sgkIsveren'), 'İşveren SGK + işsizlik primi; teşvikten yararlanıyorsanız indirimli oranı girin. Bordronuzla kontrol edin.')}
      </div>
      <div class="kaydir"><table class="tablo personel-tablo">
        <thead><tr><th class="sol">Departman</th><th class="sol">Pozisyon</th><th>Tümü<span class="yil">→</span></th>
          ${d.aylar.map((m) => `<th>${ayBaslik(m, d.oranlar[m])}</th>`).join('')}
          <th>Ort. Kişi<span class="yil">2026</span></th><th>Brüt Maaş<span class="yil">güncel / ay</span></th><th>Yan Hak<span class="yil">kişi / ay</span></th>
          <th>Maliyet<span class="yil">2026</span></th><th></th></tr></thead>
        <tbody>${satirlar || `<tr><td class="sol bos" colspan="${d.aylar.length + 8}">Henüz personel yok. Aşağıdan ekleyin.</td></tr>`}
          <tr class="toplam"><td class="sol" colspan="3">Toplam kişi</td>
            ${d.aylar.map((m) => cikti(`personelOzet.aylik26.${m}`, 'kisi')).join('')}
            ${cikti('personelOzet.kisi26', 'kisi')}<td colspan="2"></td>${cikti('personelOzet.maliyet26')}<td></td></tr>
        </tbody>
      </table></div>
      <button type="button" class="ekle" data-ekle="personel">+ Personel satırı ekle</button>
      <p class="ipucu">Maliyet = Σ (ay kişi sayısı × brüt maaş × ayın çalışılan oranı) × (1 + SGK işveren payı) + yan haklar.</p>
    </section>`;
  },

  'v26-giderler': () => {
    const kategoriler = giderKategorileri();
    const katSecenek = Object.fromEntries(kategoriler.map((k) => [k, k]));
    const gruplar = kategoriler.map((kat) => {
      const idxler = veri.giderler.map((g, i) => (g.kategori === kat ? i : -1)).filter((i) => i >= 0);
      const satirlar = idxler.map((i) => {
        const g = veri.giderler[i];
        const tutar = g.tip === 'gelirYuzdesi'
          ? `<td class="girdi">${sayiGirdi(`giderler.${i}.oran`, { cls: 'kisa', etiket: 'Oran' })} %
             ${secim(`giderler.${i}.baz`, { oda: 'oda gelirinin', toplam: 'toplam gelirin' }, { etiket: 'Baz' })}</td>`
          : `<td class="girdi">${sayiGirdi(`giderler.${i}.tutar2026`, { min: 0, etiket: '2026 yıllık tutar' })}</td>`;
        return `<tr>
          <td class="sol girdi">${metinGirdi(`giderler.${i}.ad`, { ph: 'Gider kalemi', etiket: 'Gider kalemi' })}</td>
          <td class="sol girdi">${secim(`giderler.${i}.tip`, GIDER_TIPLERI, { yeniden: true, etiket: 'Gider tipi' })}</td>
          ${tutar}
          ${cikti(`giderler.${i}.tutar26`)}
          <td class="sol girdi">${secim(`giderler.${i}.kategori`, katSecenek, { yeniden: true, etiket: 'Kategori' })}</td>
          <td>${silDugme('giderler', i)}</td></tr>`;
      }).join('');
      return `<div class="gider-grup">
        <div class="gider-grup-baslik"><h3>${esc(kat)}</h3></div>
        ${idxler.length ? `<div class="kaydir"><table class="tablo gider-tablo"><colgroup>
          <col style="width:26%"><col style="width:20%"><col style="width:22%"><col style="width:13%"><col style="width:16%"><col style="width:40px"></colgroup>
          <thead><tr><th class="sol">Gider Kalemi</th><th class="sol">Nasıl oluşur?</th><th>Yıllık Tutar / Oran<span class="yil">2026</span></th>
          <th>Tutar<span class="yil">2026</span></th><th class="sol">Kategori</th><th></th></tr></thead><tbody>${satirlar}</tbody></table></div>`
          : '<p class="bos">Bu kategoride kalem yok.</p>'}
        <button type="button" class="ekle" data-ekle="giderler" data-kategori="${esc(kat)}">+ ${esc(kat)} kalemi ekle</button>
      </div>`;
    }).join('');
    return `
    <section class="kart">
      <h2>2026 Giderler (personel hariç)</h2>
      <p class="aciklama">2026 yılı gerçekleşen (veya yıl sonu tahmini) yıllık tutarları girin. "Nasıl oluşur?" seçimi 2027 hesabını belirler:
        <strong>Sabit</strong> (kira, sigorta) · <strong>Değişken</strong> – dolulukla artar (elektrik, su, yiyecek maliyeti) ·
        <strong>Gelirin yüzdesi</strong> (konaklama vergisi, acente komisyonu).</p>
      ${gruplar}
      <table class="tablo" style="margin-top:16px"><tbody>
        <tr class="toplam"><td class="sol">Toplam Gider 2026 (personel hariç)</td><td><span data-cikti="gider26" data-bicim="para"></span></td></tr>
      </tbody></table>
    </section>`;
  },

  // ======================= 2 · 2027 KARARLARI =======================
  'k27-genel': () => {
    const v = 'varsayimlar';
    const enf = veri.varsayimlar.enflasyon;
    return `
    <section class="kart">
      <h2>2027 Genel Zam Kararları</h2>
      <p class="aciklama">2027'de beklediğiniz / uygulayacağınız zamlar. Bunlar varsayılan oranlardır; sonraki sekmelerde oda tipi,
        pozisyon veya gider kalemi bazında farklı oran girebilirsiniz. Boş bırakılan oran %0 kabul edilir.</p>
      <div class="form-izgara">
        ${alan('Genel enflasyon beklentisi (%)', sayiGirdi(`${v}.enflasyon`, { ph: '%0' }), 'Kategori zammı girilmeyen giderler, diğer gelirler ve yan haklar için.')}
        ${alan('Oda fiyatı zammı (%)', sayiGirdi(`${v}.odaFiyatZam`, { ph: '%0' }), '2026 ortalama fiyatına göre.')}
        ${alan('Maaş zammı – Ocak 2027 (%)', sayiGirdi(`${v}.ocakZam`, { ph: '%0' }), 'Güncel maaşa göre.')}
        ${alan('Maaş zammı – Temmuz 2027 (%)', sayiGirdi(`${v}.temmuzZam`, { ph: '%0' }), 'Ocak zamlı maaşın üzerine.')}
        ${veri.otel.calismaSekli === 'sezon'
          ? `${alan('2027 sezon açılışı', tarihGirdi('otel.sezon2027Bas'), `Boşsa ${tarihBicim(yilaTasi(veri.otel.sezon2026Bas, 2027)) || '2026 ile aynı gün'}`)}
             ${alan('2027 sezon kapanışı', tarihGirdi('otel.sezon2027Bit'), `Boşsa ${tarihBicim(yilaTasi(veri.otel.sezon2026Bit, 2027)) || '2026 ile aynı gün'} · ${fnAlan('donemBilgi27', 'span')}`)}`
          : alan('2027 açık gün sayısı', sayiGirdi('otel.acikGun2027', { min: 0, max: 366, ph: `2026 ile aynı (${veri.otel.acikGun2026 ?? 365})` }), fnAlan('donemBilgi27', 'span'))}
        ${alan('Kurumlar vergisi (%)', sayiGirdi(`${v}.kurumlarVergisi`))}
      </div>
    </section>
    <section class="kart">
      <h2>Gider Kategorilerine Göre 2027 Zamları</h2>
      <p class="aciklama">Kira, elektrik, vergi gibi kalemler için beklediğiniz artış. Boş bırakılanlar genel enflasyonu kullanır.</p>
      <div class="form-izgara">
        ${KATEGORILER.map((k) => alan(`${esc(k)} (%)`, sayiGirdi(`${v}.kategoriZam.${k}`, { ph: `Enflasyon (${zamPh(enf)})`, phEnf: true }))).join('')}
      </div>
    </section>`;
  },

  'k27-odalar': () => {
    const v = veri.varsayimlar;
    const satirlar = veri.odalar.map((o, i) => `<tr>
      ${roAd(o.ad, `Oda tipi ${i + 1}`)}
      ${ro(nf0.format(Number(o.adet) || 0))}
      <td class="girdi">${sayiGirdi(`odalar.${i}.adet2027`, { cls: 'kisa', min: 0, ph: String(o.adet ?? ''), etiket: '2027 oda adedi' })}</td>
      ${roPara(o.fiyat2026)}
      <td class="girdi">${sayiGirdi(`odalar.${i}.fiyatZam`, { cls: 'kisa', ph: zamPh(v.odaFiyatZam), etiket: 'Fiyat zammı' })}</td>
      ${cikti(`odalar.${i}.fiyat27`, 'para', 'vurgu')}
      ${roYz(o.doluluk2026)}
      <td class="girdi">${sayiGirdi(`odalar.${i}.doluluk2027`, { cls: 'kisa', min: 0, max: 100, ph: String(o.doluluk2026 ?? ''), etiket: '2027 doluluk' })}</td>
      ${cikti(`odalar.${i}.satilan27`, 'sayi0')}${cikti(`odalar.${i}.gelir26`)}${cikti(`odalar.${i}.gelir27`)}</tr>`).join('');
    const gelirSatirlari = veri.digerGelirler.map((g, i) => `<tr>
      ${roAd(g.ad, `Gelir ${i + 1}`)}${roPara(g.tutar2026)}${ro(g.tip === 'degisken' ? 'Dolulukla değişir' : 'Sabit', 'sol')}
      <td class="girdi">${sayiGirdi(`digerGelirler.${i}.artis`, { cls: 'kisa', ph: zamPh(v.enflasyon), etiket: 'Fiyat artışı' })}</td>
      ${cikti(`digerGelirler.${i}.tutar27`)}</tr>`).join('');
    return `
    ${veri.odaGiris === 'toplam' ? toplamOda27(v) : tipOda27(satirlar, v)}
    ${veri.digerGelirler.length ? `<section class="kart">
      <h2>2027 Diğer Gelirler</h2>
      <p class="aciklama">Oda dışı gelirlerde 2027 fiyat artışı. Boş bırakılanlar genel enflasyonu (${zamPh(v.enflasyon)}) kullanır.</p>
      <div class="kaydir"><table class="tablo">
        <thead><tr><th class="sol">Gelir Kalemi</th><th>Tutar<span class="yil">2026</span></th><th class="sol">Nasıl değişir?</th>
          <th>Fiyat Artışı %<span class="yil">2027</span></th><th>Tutar<span class="yil">2027</span></th></tr></thead>
        <tbody>${gelirSatirlari}
          <tr class="toplam"><td class="sol">Toplam</td>${cikti('digerGelir26')}<td></td><td></td>${cikti('digerGelir27')}</tr></tbody>
      </table></div>
    </section>` : ''}`;
  },

  'k27-personel': () => {
    const v = veri.varsayimlar;
    const d = sonuc.donem27;
    const satirlar = veri.personel.map((p, i) => {
      const r = sonuc.personel[i];
      return `<tr>
      <td class="sol girdi">${metinGirdi(`personel.${i}.departman`, { ph: 'Departman', etiket: 'Departman' })}</td>
      <td class="sol girdi">${metinGirdi(`personel.${i}.pozisyon`, { ph: 'Pozisyon', etiket: 'Pozisyon' })}</td>
      <td class="girdi" style="text-align:center">${kutu(`personel.${i}.dolulugaBagli`, { yeniden: true, etiket: 'Doluluğa bağlı' })}</td>
      <td class="girdi"><input type="number" class="ay-girdi doldur" min="0" data-doldur="personel.${i}.aylik2027" data-yil="2027"
        placeholder="→" aria-label="Tüm aylara aynı kişi sayısını yaz" title="Tüm aylara aynı sayıyı yaz"></td>
      ${d.aylar.map((m) => `<td class="girdi">${sayiGirdi(`personel.${i}.aylik2027.${m}`, {
        cls: 'ay-girdi', min: 0, etiket: `${AYLAR[m]} 2027 kişi`, ph: kisiBicim(r?.onerilenAylik27[m] ?? 0) })}</td>`).join('')}
      ${cikti(`personel.${i}.kisi27`, 'kisi')}
      ${roPara(p.maas2026)}
      <td class="girdi">${sayiGirdi(`personel.${i}.ocakZam`, { cls: 'kisa', ph: zamPh(v.ocakZam), etiket: 'Ocak zammı' })}</td>
      <td class="girdi">${sayiGirdi(`personel.${i}.maas2027`, { ph: 'veya tutar', etiket: 'Ocak 2027 brüt maaş (doğrudan)' })}</td>
      <td class="girdi">${sayiGirdi(`personel.${i}.temmuzZam`, { cls: 'kisa', ph: zamPh(v.temmuzZam), etiket: 'Temmuz zammı' })}</td>
      ${cikti(`personel.${i}.maasOcak27`)}${cikti(`personel.${i}.maasTemmuz27`)}
      ${cikti(`personel.${i}.maliyet26`)}${cikti(`personel.${i}.maliyet27`)}
      <td>${silDugme('personel', i)}</td></tr>`;
    }).join('');
    return `
    <section class="kart">
      <h2>2027 Personel ve Maaş Kararları</h2>
      <p class="aciklama">2027'de her ay kaç kişi çalışacağını ve maaş zammını belirleyin. Zam kutusu boşsa genel zam
        (Ocak ${zamPh(v.ocakZam)}, Temmuz ${zamPh(v.temmuzZam)}) uygulanır; zam yerine Ocak 2027 brüt maaşını doğrudan da yazabilirsiniz.
        Ocak–Haziran ayları Ocak maaşıyla, Temmuz–Aralık ayları Temmuz zamlı maaşla hesaplanır.</p>
      <p class="aciklama">${fnAlan('kisiOneri', 'span')}</p>
      <div class="kaydir"><table class="tablo personel-tablo">
        <thead><tr><th class="sol">Departman</th><th class="sol">Pozisyon</th><th>Doluluğa<span class="yil">bağlı</span></th><th>Tümü<span class="yil">→</span></th>
          ${d.aylar.map((m) => `<th>${ayBaslik(m, d.oranlar[m])}</th>`).join('')}
          <th>Ort. Kişi<span class="yil">2027</span></th><th>Brüt Maaş<span class="yil">güncel</span></th><th>Ocak Zammı<span class="yil">%</span></th>
          <th>veya Ocak Maaşı<span class="yil">brüt, doğrudan</span></th><th>Temmuz Zammı<span class="yil">%</span></th>
          <th>Brüt Maaş<span class="yil">Oca 2027</span></th><th>Brüt Maaş<span class="yil">Tem 2027</span></th>
          <th>Maliyet<span class="yil">2026</span></th><th>Maliyet<span class="yil">2027</span></th><th></th></tr></thead>
        <tbody>${satirlar || `<tr><td class="sol bos" colspan="${d.aylar.length + 14}">Önce 2026 personelini girin.</td></tr>`}
          <tr class="toplam"><td class="sol" colspan="4">Toplam kişi</td>
            ${d.aylar.map((m) => cikti(`personelOzet.aylik27.${m}`, 'kisi')).join('')}
            ${cikti('personelOzet.kisi27', 'kisi')}<td colspan="6"></td>${cikti('personelOzet.maliyet26')}${cikti('personelOzet.maliyet27')}<td></td></tr>
        </tbody>
      </table></div>
      <button type="button" class="ekle" data-ekle="personel" data-yeni27="1">+ 2027'de yeni pozisyon ekle</button>
    </section>
    <section class="kart">
      <h2>Aylık Personel Planı – Her Ay Kaç Kişi Çalışacak?</h2>
      <p class="aciklama">Büyük rakam 2027 planı, altındaki 2026.</p>
      ${fnAlan('aylikPersonel')}
    </section>
    <section class="kart">
      <h2>Departman Özeti</h2>
      ${fnAlan('departmanlar')}
    </section>`;
  },

  'k27-giderler': () => {
    const v = veri.varsayimlar;
    const gruplar = giderKategorileri().map((kat) => {
      const idxler = veri.giderler.map((g, i) => (g.kategori === kat ? i : -1)).filter((i) => i >= 0);
      if (!idxler.length) return '';
      const katZam = v.kategoriZam?.[kat];
      const varsayilan = katZam === '' || katZam == null ? v.enflasyon : katZam;
      const satirlar = idxler.map((i) => {
        const g = veri.giderler[i];
        const karar = g.tip === 'gelirYuzdesi'
          ? `${roYz(g.oran)}<td class="girdi">${sayiGirdi(`giderler.${i}.oran2027`, { cls: 'kisa', ph: `%${g.oran ?? 0}`, etiket: '2027 oran' })} %</td><td class="salt sol">${g.baz === 'toplam' ? 'toplam gelirin' : 'oda gelirinin'}</td>`
          : `${roPara(g.tutar2026)}<td class="girdi">${sayiGirdi(`giderler.${i}.artis`, { cls: 'kisa', ph: zamPh(varsayilan), etiket: '2027 zam' })}</td>
             <td class="girdi">${sayiGirdi(`giderler.${i}.tutar2027`, { ph: 'veya tutar', etiket: '2027 tutar (doğrudan)' })}</td>`;
        return `<tr><td class="sol girdi">${metinGirdi(`giderler.${i}.ad`, { ph: 'Gider kalemi', etiket: 'Gider kalemi' })}</td>${ro(TIP_KISA[g.tip] || g.tip, 'sol')}${karar}
          ${cikti(`giderler.${i}.tutar26`)}${cikti(`giderler.${i}.tutar27`)}
          <td class="cikti" data-fn-satir="giderDegisim" data-index="${i}"></td></tr>`;
      }).join('');
      return `<div class="gider-grup">
        <div class="gider-grup-baslik"><h3>${esc(kat)}</h3><span class="ipucu">Kategori zammı: ${zamPh(varsayilan)}</span></div>
        <div class="kaydir"><table class="tablo gider-tablo"><colgroup>
          <col style="width:22%"><col style="width:10%"><col style="width:13%"><col style="width:11%"><col style="width:13%">
          <col style="width:12%"><col style="width:12%"><col style="width:9%"></colgroup>
          <thead><tr><th class="sol">Gider Kalemi</th><th class="sol">Tip</th><th>Tutar / Oran<span class="yil">2026</span></th>
          <th>Zam % / Oran<span class="yil">2027</span></th><th>veya Tutar<span class="yil">2027, doğrudan</span></th>
          <th>Tutar<span class="yil">2026</span></th><th>Tutar<span class="yil">2027</span></th><th>Değişim</th></tr></thead>
          <tbody>${satirlar}</tbody></table></div>
        <button type="button" class="ekle" data-ekle="giderler" data-kategori="${esc(kat)}" data-yeni27="1">+ 2027'de yeni ${esc(kat)} kalemi</button>
      </div>`;
    }).join('');
    return `
    <section class="kart">
      <h2>2027 Gider Kararları</h2>
      <p class="aciklama">Her kalem için zam oranı girin veya kesinleşmiş tutarı (ör. imzalanmış kira sözleşmesi) doğrudan yazın.
        Boş bırakılan zam, kategori zammını (<strong>Genel Zamlar</strong> sekmesi), o da yoksa genel enflasyonu kullanır.
        Değişken giderler ayrıca satılan oda sayısındaki değişimle orantılı artar.</p>
      ${gruplar || '<div class="mesaj">Önce <strong>1 · 2026 Verileri → Giderler</strong> sekmesinde giderleri girin.</div>'}
      <table class="tablo" style="margin-top:16px"><tbody>
        <tr class="toplam"><td class="sol">Toplam Gider (personel hariç)</td><td>2026: <span data-cikti="gider26" data-bicim="para"></span></td>
        <td>2027: <span data-cikti="gider27" data-bicim="para"></span></td></tr>
      </tbody></table>
    </section>`;
  },

  // ======================= 3 · SONUÇ =======================
  ozet: () => `${fnAlan('ozet')}`,

  hedef: () => `
    <section class="kart">
      <h2>Odayı Kaçtan Satmalıyız?</h2>
      <p class="aciklama">2027 giderleri ve planlanan doluluğa göre, zarar etmemek ve hedef kâra ulaşmak için gereken ortalama oda fiyatı.</p>
      <div class="form-izgara" style="margin-bottom:12px">
        <div class="alan"><label>Hedef kâr marjı (%)</label>${sayiGirdi('varsayimlar.hedefKarMarji')}
          <p class="ipucu">Vergi öncesi kârın toplam gelire oranı.</p></div>
      </div>
      ${fnAlan('hedefKartlar')}
      ${fnAlan('hedefMesaj')}
      <h3>Oda tiplerine göre hedef fiyatlar</h3>
      <p class="aciklama">Tüm oda tiplerine aynı oranda uygulanır; fiyat oranlarınızı korur.</p>
      ${fnAlan('hedefOdalar')}
    </section>
    <section class="kart">
      <h2>Senaryo Tablosu – 2027 Vergi Öncesi Kâr</h2>
      <p class="aciklama">Planlanan 2027 fiyatları ±%10, doluluk ±10 puan değişirse kâr ne olur? Doluluğa bağlı personel ve değişken giderler de birlikte değişir.
        Çerçeveli hücre mevcut plan, kırmızı hücreler zarar.</p>
      ${fnAlan('duyarlilik')}
    </section>`,
};

function ozetHtml(s) {
  if (!odaVarMi() && !veri.personel.length && !veri.giderler.length) {
    return `<section class="kart baslarken">
      <h2>Başlarken</h2>
      <p class="aciklama">Bütçe üç adımda hazırlanır:</p>
      <ol>
        <li><strong>2026 Verileri:</strong> Oda tiplerini, fiyat ve doluluğu, personel ve maaşları, giderleri 2026'da gerçekleştiği gibi girin.</li>
        <li><strong>2027 Kararları:</strong> Oda fiyatı zammı, hedef doluluk, kaç kişi çalışacağı, maaş zamları, kira/elektrik/vergi zamlarını belirleyin.</li>
        <li><strong>Sonuç:</strong> 2027 gelir-gider tablosunu, kârı ve odayı en az kaçtan satmanız gerektiğini görün.</li>
      </ol>
      <button type="button" class="birincil" data-sekme="v26-odalar">2026 verilerini girmeye başla →</button>
      <p class="ipucu">Nasıl göründüğünü merak ediyorsanız sağ üstteki <strong>Diğer → Örnek veriyi yükle</strong> ile deneme verisi yükleyebilirsiniz.</p>
    </section>`;
  }
  const satir = (ad, a, b, cls = '') => `<tr class="${cls}"><td class="sol">${ad}</td><td>${para(a)}</td><td>${para(b)}</td>
    <td>${degisim(a, b)}</td><td>${yz(s.gelir27 ? b / s.gelir27 : null)}</td></tr>`;
  const digerSatirlar = veri.digerGelirler.map((g, i) => satir(`&nbsp;&nbsp;${esc(g.ad || 'Diğer gelir')}`, s.digerGelirler[i].tutar26, s.digerGelirler[i].tutar27)).join('');
  const katSatirlar = s.kategoriler.map((k) => satir(`&nbsp;&nbsp;${esc(k.ad)}`, k.tutar26, k.tutar27)).join('');

  const dagilim = [{ ad: 'Personel', tutar: s.personelOzet.maliyet27 }, ...s.kategoriler.map((k) => ({ ad: k.ad, tutar: k.tutar27 }))]
    .filter((x) => x.tutar > 0)
    .sort((a, b) => b.tutar - a.tutar);
  const enBuyuk = Math.max(1, ...dagilim.map((x) => x.tutar));
  const cubuklar = dagilim.map((x) => `<div class="cubuk-satir" title="${esc(x.ad)}: ${para(x.tutar)} (${yz(x.tutar / s.toplamGider27)})">
      <span class="ad">${esc(x.ad)}</span>
      <div><div class="cubuk" style="width:${(x.tutar / enBuyuk) * 100}%"></div></div>
      <span class="deger">${yz(x.tutar / s.toplamGider27)}</span></div>`).join('');

  const kart = (etiket, deger, alt, vurgulu = false) =>
    `<div class="kpi-kart${vurgulu ? ' vurgulu' : ''}"><div class="etiket">${etiket}</div><div class="deger">${deger}</div><div class="fark">${alt}</div></div>`;

  return `
  <div class="kpi-izgara">
    ${kart('2027 Net Kâr (vergi sonrası)', `<span class="${s.net27 < 0 ? 'negatif' : ''}">${para(s.net27)}</span>`, `2026: ${para(s.net26)} ${degisim(s.net26, s.net27)}`, true)}
    ${kart('RevPAR 2027', para(s.oda.revpar27), `2026: ${para(s.oda.revpar26)} ${degisim(s.oda.revpar26, s.oda.revpar27)}`)}
    ${kart('Satılan oda-gece 2027', nf0.format(s.oda.satilan27), `2026: ${nf0.format(s.oda.satilan26)} ${degisim(s.oda.satilan26, s.oda.satilan27)}`)}
    ${kart('Personel maliyeti / gelir', yz(s.personelOrani27), `2026: ${yz(s.personelOrani26)}`)}
    ${kart('Başa baş oda fiyatı 2027', para(s.hedef.basaBasAdr), `Planlanan: ${para(s.oda.adr27)}`)}
  </div>
  <div class="iki-sutun">
    <section class="kart">
      <h2>2027 Bütçe – Gelir Gider Tablosu</h2>
      <p class="aciklama">${esc(veri.otel.ad || '')} · Tutarlar KDV hariç, ${esc(pb())}</p>
      <div class="kaydir"><table class="tablo">
        <thead><tr><th class="sol">Kalem</th><th>2026</th><th>2027 Bütçe</th><th>Değişim</th><th>Gelire Oranı<span class="yil">2027</span></th></tr></thead>
        <tbody>
          ${satir('Oda Gelirleri', s.oda.gelir26, s.oda.gelir27)}
          ${digerSatirlar}
          ${satir('TOPLAM GELİR', s.gelir26, s.gelir27, 'ara')}
          ${satir('Personel Giderleri', s.personelOzet.maliyet26, s.personelOzet.maliyet27)}
          ${katSatirlar}
          ${satir('TOPLAM GİDER', s.toplamGider26, s.toplamGider27, 'ara')}
          ${satir('VERGİ ÖNCESİ KÂR', s.kar26, s.kar27, 'kar')}
          ${satir('Kurumlar Vergisi', s.kv26, s.kv27)}
          ${satir('NET KÂR', s.net26, s.net27, 'kar')}
        </tbody>
      </table></div>
      <p class="ipucu">Amortisman ve kredi faizi dahil değildir; isterseniz "Diğer Giderler" altına ekleyebilirsiniz.</p>
    </section>
    <div>
      <section class="kart">
        <h2>2027 Gider Dağılımı</h2>
        <p class="aciklama">Toplam giderin kalemlere göre payı</p>
        <div class="cubuk-liste">${cubuklar || '<p class="bos">Gider yok.</p>'}</div>
      </section>
      <section class="kart">
        <h2>Temel Göstergeler</h2>
        <div class="kaydir"><table class="tablo">
          <thead><tr><th class="sol">Gösterge</th><th>2026</th><th>2027</th><th>Değişim</th></tr></thead>
          <tbody>
            <tr><td class="sol">Oda sayısı</td><td>${nf0.format(s.oda.adet)}</td><td>${nf0.format(s.oda.adet27)}</td><td></td></tr>
            <tr><td class="sol">Doluluk</td><td>${yz(s.oda.doluluk26)}</td><td>${yz(s.oda.doluluk27)}</td><td>${nf1.format((s.oda.doluluk27 - s.oda.doluluk26) * 100)} puan</td></tr>
            <tr><td class="sol">Ort. oda fiyatı (ADR)</td><td>${para(s.oda.adr26)}</td><td>${para(s.oda.adr27)}</td><td>${degisim(s.oda.adr26, s.oda.adr27)}</td></tr>
            <tr><td class="sol">RevPAR</td><td>${para(s.oda.revpar26)}</td><td>${para(s.oda.revpar27)}</td><td>${degisim(s.oda.revpar26, s.oda.revpar27)}</td></tr>
            <tr><td class="sol">GOPPAR (müsait oda başı kâr)</td><td>${para(s.goppar26)}</td><td>${para(s.goppar27)}</td><td>${degisim(s.goppar26, s.goppar27)}</td></tr>
            <tr><td class="sol">Personel sayısı</td><td>${nf0.format(s.personelOzet.kisi26)}</td><td>${nf0.format(s.personelOzet.kisi27)}</td><td>${degisim(s.personelOzet.kisi26, s.personelOzet.kisi27)}</td></tr>
            <tr><td class="sol">Oda başına personel</td><td>${nf2.format(s.personelOdaOrani26)}</td><td>${nf2.format(s.personelOdaOrani27)}</td><td></td></tr>
            <tr><td class="sol">Kâr marjı</td><td>${yz(s.marj26)}</td><td>${yz(s.marj27)}</td><td>${nf1.format((s.marj27 - s.marj26) * 100)} puan</td></tr>
          </tbody>
        </table></div>
      </section>
    </div>
  </div>
  <section class="kart">
    <h2>Departmanlara Göre Personel</h2>
    ${FN.departmanlar(s)}
  </section>`;
}

// ---------------- Çizim ----------------
const $icerik = document.getElementById('icerik');

function menuCiz() {
  const gruplar = [...new Set(SIRA.map((x) => x.grup))];
  document.getElementById('sekmeler').innerHTML = gruplar.map((g) => `<div class="sekme-grup">
      <span class="grup-ad">${esc(g)}</span>
      <div class="grup-dugmeler">${SIRA.filter((x) => x.grup === g).map((x) =>
        `<button type="button" role="tab" data-sekme="${x.id}" aria-selected="${x.id === aktifSekme}">${esc(x.ad)}</button>`).join('')}</div>
    </div>`).join('');
}

function sekmeCiz() {
  if (!SEKMELER[aktifSekme]) aktifSekme = odaVarMi() ? 'ozet' : 'v26-odalar';
  menuCiz();
  sonuc = hesapla(veri);
  const sira = SIRA.findIndex((x) => x.id === aktifSekme);
  const sonraki = SIRA[sira + 1];
  $icerik.innerHTML = SEKMELER[aktifSekme]() + (sonraki
    ? `<div class="sonraki"><button type="button" class="birincil" data-sekme="${sonraki.id}">Sonraki adım: ${esc(sonraki.grup.split('·')[1].trim())} → ${esc(sonraki.ad)}</button></div>`
    : '');
  ciktilariYaz();
}

function ciktilariYaz() {
  sonuc = hesapla(veri);
  document.getElementById('otel-adi').textContent = veri.otel?.ad || 'Otel Bütçeleme';
  document.getElementById('kpi-serit').innerHTML = FN.kpiSerit(sonuc);
  document.querySelectorAll('[data-cikti]').forEach((el) => {
    const deger = yolOku(sonuc, el.dataset.cikti);
    el.textContent = (BICIMLER[el.dataset.bicim] || para)(deger);
  });
  document.querySelectorAll('[data-ph-enf]').forEach((el) => {
    el.placeholder = `Enflasyon (%${veri.varsayimlar.enflasyon ?? 0})`;
  });
  document.querySelectorAll('[data-fn]').forEach((el) => {
    el.innerHTML = FN[el.dataset.fn](sonuc);
  });
  document.querySelectorAll('[data-fn-satir="giderDegisim"]').forEach((el) => {
    const g = sonuc.giderler[Number(el.dataset.index)];
    el.innerHTML = g ? degisim(g.tutar26, g.tutar27) : '';
  });
}

// ---------------- Kaydetme ----------------
const $durum = document.getElementById('kayit-durumu');
let kayitZamanlayici = null;
function durum(metin, hata = false) {
  $durum.textContent = metin;
  $durum.classList.toggle('hata', hata);
}
function kaydetPlanla() {
  durum('Kaydediliyor…');
  clearTimeout(kayitZamanlayici);
  kayitZamanlayici = setTimeout(kaydet, 600);
}
async function kaydet() {
  try {
    const yanit = await fetch('/api/veri', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(veri),
    });
    if (!yanit.ok) throw new Error(yanit.statusText);
    durum(`Kaydedildi ✓ ${new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`);
  } catch (e) {
    durum('Kaydedilemedi! Sunucu çalışıyor mu?', true);
  }
}

function veriyiKoy(yeni) {
  const temel = bosVeri();
  veri = {
    ...temel,
    ...yeni,
    otel: { ...temel.otel, ...(yeni.otel || {}) },
    varsayimlar: { ...temel.varsayimlar, ...(yeni.varsayimlar || {}) },
  };
  for (const liste of ['odalar', 'digerGelirler', 'personel', 'giderler']) {
    if (!Array.isArray(veri[liste])) veri[liste] = [];
  }
  veri.varsayimlar.kategoriZam ||= {};
  if (!yeni.odaGiris) veri.odaGiris = veri.odalar.length ? 'tip' : 'toplam';
  veri.odaToplam = { ...temel.odaToplam, ...(yeni.odaToplam || {}) };
  // Eski kayıtlar: tek kişi sayısı girilmiş, yıl boyu çalışan satırları aylık girişe çevir.
  for (const p of veri.personel) {
    const tamYil = (x) => x === '' || x == null || Number(x) >= 12;
    if (!aylikVarMi(p.aylik2026) && p.kisi2026 !== '' && p.kisi2026 != null && tamYil(p.ay) && tamYil(p.ay2027)) {
      p.aylik2026 = AYLAR.map(() => Number(p.kisi2026) || 0);
      if (!aylikVarMi(p.aylik2027) && p.kisi2027 !== '' && p.kisi2027 != null) p.aylik2027 = AYLAR.map(() => Number(p.kisi2027) || 0);
      delete p.kisi2026; delete p.kisi2027; delete p.ay; delete p.ay2027;
    }
  }
}

// ---------------- Olaylar ----------------
function girdiDegisti(el) {
  const yol = el.dataset.yol;
  let deger;
  if (el.dataset.tip === 'kutu') deger = el.checked;
  else if (el.dataset.tip === 'sayi') deger = el.value === '' ? '' : Number(el.value);
  else deger = el.value;
  yolYaz(veri, yol, deger);
  if (el.dataset.yeniden) sekmeCiz();
  else ciktilariYaz();
  kaydetPlanla();
}

// "Tümü →" kutusu: yazılan sayıyı o yılın açık aylarının hepsine yazar.
document.addEventListener('input', (e) => {
  const el = e.target.closest('[data-doldur]');
  if (!el) return;
  const yil = Number(el.dataset.yil);
  const aylar = donem(veri.otel, yil).aylar;
  const deger = el.value === '' ? '' : Number(el.value);
  for (const m of aylar) {
    const yol = `${el.dataset.doldur}.${m}`;
    yolYaz(veri, yol, deger);
    const kutu = document.querySelector(`[data-yol="${yol}"]`);
    if (kutu) kutu.value = deger;
  }
  ciktilariYaz();
  kaydetPlanla();
});

document.addEventListener('input', (e) => {
  const el = e.target.closest('[data-yol]');
  if (el && el.tagName === 'INPUT' && el.type !== 'checkbox') girdiDegisti(el);
});
document.addEventListener('change', (e) => {
  const el = e.target.closest('[data-yol]');
  if (el && (el.tagName === 'SELECT' || el.type === 'checkbox')) girdiDegisti(el);
});

const YENI_SATIR = {
  odalar: () => ({ id: yeniId(), ad: '', adet: 0, fiyat2026: 0, doluluk2026: 0, adet2027: '', fiyatZam: '', doluluk2027: '' }),
  digerGelirler: () => ({ id: yeniId(), ad: '', tutar2026: 0, tip: 'sabit', artis: '' }),
  personel: () => ({ id: yeniId(), departman: '', pozisyon: '', aylik2026: AYLAR.map(() => ''), aylik2027: AYLAR.map(() => ''), maas2026: 0, yanHak: '', dolulugaBagli: false, ocakZam: '', maas2027: '', temmuzZam: '' }),
  giderler: (kategori) => ({ id: yeniId(), kategori: kategori || 'Diğer Giderler', ad: '', tip: 'sabit', tutar2026: 0, artis: '', tutar2027: '', baz: 'oda', oran: 0, oran2027: '' }),
};

document.addEventListener('click', async (e) => {
  const sekme = e.target.closest('[data-sekme]');
  if (sekme) {
    aktifSekme = sekme.dataset.sekme;
    try { localStorage.setItem('aktifSekme', aktifSekme); } catch { /* yok say */ }
    sekmeCiz();
    window.scrollTo({ top: 0 });
    return;
  }
  const ekle = e.target.closest('[data-ekle]');
  if (ekle) {
    const liste = ekle.dataset.ekle;
    const satir = YENI_SATIR[liste](ekle.dataset.kategori);
    if (ekle.dataset.yeni27 && liste === 'personel') Object.assign(satir, { aylik2026: AYLAR.map(() => 0) });
    veri[liste].push(satir);
    sekmeCiz();
    kaydetPlanla();
    const son = [...document.querySelectorAll(`[data-yol^="${liste}.${veri[liste].length - 1}."]`)].find((x) => x.type === 'text');
    son?.focus();
    return;
  }
  const sil = e.target.closest('[data-sil]');
  if (sil) {
    const liste = sil.dataset.sil;
    const i = Number(sil.dataset.index);
    const ad = veri[liste][i]?.ad || veri[liste][i]?.pozisyon || 'bu satır';
    if (!confirm(`"${ad}" silinsin mi?`)) return;
    veri[liste].splice(i, 1);
    sekmeCiz();
    kaydetPlanla();
    return;
  }
  const islem = e.target.closest('[data-islem]')?.dataset.islem;
  if (!islem) return;
  e.target.closest('details')?.removeAttribute('open');
  if (islem === 'json') indir(`butce-${dosyaAdi()}.json`, JSON.stringify(veri, null, 2), 'application/json');
  if (islem === 'csv') indir(`butce-2027-${dosyaAdi()}.csv`, '﻿' + csvOlustur(), 'text/csv;charset=utf-8');
  if (islem === 'yazdir') {
    if (aktifSekme !== 'ozet') { aktifSekme = 'ozet'; sekmeCiz(); }
    window.print();
  }
  if (islem === 'ornek' && confirm('Mevcut verilerin yerine örnek veri yüklensin mi? (Önce "Yedek indir" ile yedek almanız önerilir.)')) {
    const yanit = await fetch('/api/ornek');
    veriyiKoy(await yanit.json());
    sekmeCiz();
    kaydetPlanla();
  }
  if (islem === 'bos' && confirm('Tüm veriler silinip boş bir bütçe başlatılsın mı? (Önce "Yedek indir" ile yedek almanız önerilir.)')) {
    veriyiKoy(bosVeri());
    sekmeCiz();
    kaydetPlanla();
  }
});

document.getElementById('ice-aktar').addEventListener('change', async (e) => {
  const dosya = e.target.files[0];
  e.target.value = '';
  if (!dosya) return;
  try {
    const yeni = JSON.parse(await dosya.text());
    if (!yeni || typeof yeni !== 'object' || Array.isArray(yeni)) throw new Error('biçim');
    if (!confirm('Yedek dosyası mevcut verilerin yerine yüklensin mi?')) return;
    veriyiKoy(yeni);
    sekmeCiz();
    kaydetPlanla();
  } catch {
    alert('Dosya okunamadı. Lütfen bu programdan indirilmiş bir yedek (.json) seçin.');
  }
});

// ---------------- Dışa aktarma ----------------
function dosyaAdi() {
  return (veri.otel.ad || 'otel').toLocaleLowerCase('tr-TR').replace(/[^a-z0-9çğıöşü]+/gi, '-').replace(/^-|-$/g, '') || 'otel';
}
function indir(ad, icerik, tip) {
  const url = URL.createObjectURL(new Blob([icerik], { type: tip }));
  const a = Object.assign(document.createElement('a'), { href: url, download: ad });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function csvOlustur() {
  // Türkçe Excel için: ayraç ";" ve ondalık ",".
  const s = sonuc;
  const hucre = (x) => {
    if (typeof x === 'number') return Number.isFinite(x) ? String(Math.round(x * 100) / 100).replace('.', ',') : '';
    const m = String(x ?? '');
    return /[;"\n]/.test(m) ? `"${m.replace(/"/g, '""')}"` : m;
  };
  const satirlar = [];
  const ekle = (...h) => satirlar.push(h.map(hucre).join(';'));
  ekle(`${veri.otel.ad} - 2027 Bütçesi`);
  ekle();
  ekle('GELİR GİDER TABLOSU', '2026', '2027');
  ekle('Oda Gelirleri', s.oda.gelir26, s.oda.gelir27);
  veri.digerGelirler.forEach((g, i) => ekle(g.ad, s.digerGelirler[i].tutar26, s.digerGelirler[i].tutar27));
  ekle('TOPLAM GELİR', s.gelir26, s.gelir27);
  ekle('Personel Giderleri', s.personelOzet.maliyet26, s.personelOzet.maliyet27);
  s.kategoriler.forEach((k) => ekle(k.ad, k.tutar26, k.tutar27));
  ekle('TOPLAM GİDER', s.toplamGider26, s.toplamGider27);
  ekle('VERGİ ÖNCESİ KÂR', s.kar26, s.kar27);
  ekle('Kurumlar Vergisi', s.kv26, s.kv27);
  ekle('NET KÂR', s.net26, s.net27);
  ekle();
  ekle('ODALAR', 'Adet', 'Fiyat 2026', 'Doluluk % 2026', 'Fiyat 2027', 'Doluluk % 2027', 'Satılan 2026', 'Satılan 2027', 'Gelir 2026', 'Gelir 2027', 'Hedef Fiyat 2027');
  s.odalar.forEach((r, i) => {
    ekle(r.ad, r.adet, r.fiyat26, r.doluluk26 * 100, r.fiyat27, r.doluluk27 * 100, r.satilan26, r.satilan27, r.gelir26, r.gelir27, s.hedef.odaFiyatlari[i].hedef27 ?? '');
  });
  ekle();
  const csvAylar = [...new Set([...s.donem26.aylar, ...s.donem27.aylar])].sort((a, b) => a - b);
  ekle('PERSONEL', 'Pozisyon', 'Ort. Kişi 2026', 'Ort. Kişi 2027', 'Brüt Maaş Güncel', 'Brüt Maaş Oca 2027', 'Brüt Maaş Tem 2027', 'Maliyet 2026', 'Maliyet 2027',
    ...csvAylar.map((m) => `${AYLAR[m]} 2026`), ...csvAylar.map((m) => `${AYLAR[m]} 2027`));
  veri.personel.forEach((p, i) => {
    const r = s.personel[i];
    ekle(p.departman, p.pozisyon, r.kisi26, r.kisi27, r.maas26, r.maasOcak27, r.maasTemmuz27, r.maliyet26, r.maliyet27,
      ...csvAylar.map((m) => r.aylik26[m]), ...csvAylar.map((m) => r.aylik27[m]));
  });
  ekle();
  ekle('GİDERLER', 'Kalem', 'Tip', 'Zam %', 'Tutar 2026', 'Tutar 2027');
  veri.giderler.forEach((g, i) => {
    const r = s.giderler[i];
    ekle(g.kategori, g.ad, GIDER_TIPLERI[g.tip] || g.tip, g.tip === 'gelirYuzdesi' ? '' : r.artis, r.tutar26, r.tutar27);
  });
  ekle();
  ekle('FİYAT HEDEFİ');
  ekle('Başa baş ort. oda fiyatı', s.hedef.basaBasAdr ?? '');
  ekle(`%${veri.varsayimlar.hedefKarMarji} marj için ort. oda fiyatı`, s.hedef.hedefAdr ?? '');
  ekle('Başa baş doluluk %', s.hedef.basaBasDoluluk === null ? '' : s.hedef.basaBasDoluluk * 100);
  return satirlar.join('\r\n');
}

// ---------------- Başlangıç ----------------
(async function baslat() {
  try {
    const yanit = await fetch('/api/veri');
    veriyiKoy(await yanit.json());
    durum('Veriler yüklendi');
  } catch {
    durum('Sunucuya bağlanılamadı', true);
  }
  sekmeCiz();
})();
