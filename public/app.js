import {
  hesapla, bosVeri, KATEGORILER, GIDER_TIPLERI, DUYARLILIK_FIYAT, DUYARLILIK_DOLULUK,
} from './calc.js';

let veri = bosVeri();
let sonuc = hesapla(veri);
let aktifSekme = 'ozet';
try {
  aktifSekme = localStorage.getItem('aktifSekme') || 'ozet';
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

const BICIMLER = {
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
    if (o[k] == null) o[k] = {};
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
function secim(yol, secenekler, o = {}) {
  const deger = yolOku(veri, yol);
  const ops = Object.entries(secenekler)
    .map(([k, ad]) => `<option value="${esc(k)}"${k === deger ? ' selected' : ''}>${esc(ad)}</option>`)
    .join('');
  return `<select data-yol="${esc(yol)}" data-tip="metin" aria-label="${esc(o.etiket || yol)}"${o.yeniden ? ' data-yeniden="1"' : ''}>${ops}</select>`;
}
function kutu(yol, o = {}) {
  const deger = yolOku(veri, yol);
  return `<input type="checkbox" data-yol="${esc(yol)}" data-tip="kutu" ${deger ? 'checked' : ''} aria-label="${esc(o.etiket || yol)}">`;
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
      kpi('2027 Personel', `${nf0.format(s.personelOzet.kisi27)} kişi`, `2026: ${nf0.format(s.personelOzet.kisi26)} kişi`),
    ].join('');
  },

  ozet: (s) => ozetHtml(s),

  departmanlar: (s) => {
    if (!s.departmanlar.length) return '<p class="bos">Henüz personel eklenmedi.</p>';
    const satirlar = s.departmanlar.map((d) => `<tr>
      <td class="sol">${esc(d.ad)}</td>
      <td>${nf0.format(d.kisi26)}</td><td>${nf0.format(d.kisi27)}</td>
      <td>${d.kisi27 - d.kisi26 > 0 ? '+' : ''}${nf0.format(d.kisi27 - d.kisi26)}</td>
      <td>${para(d.maliyet26)}</td><td>${para(d.maliyet27)}</td><td>${degisim(d.maliyet26, d.maliyet27)}</td></tr>`).join('');
    const p = s.personelOzet;
    return `<div class="kaydir"><table class="tablo">
      <thead><tr><th class="sol">Departman</th><th>Kişi<span class="yil">2026</span></th><th>Kişi<span class="yil">2027</span></th><th>Fark</th>
      <th>Maliyet<span class="yil">2026</span></th><th>Maliyet<span class="yil">2027</span></th><th>Değişim</th></tr></thead>
      <tbody>${satirlar}
      <tr class="toplam"><td class="sol">Toplam</td><td>${nf0.format(p.kisi26)}</td><td>${nf0.format(p.kisi27)}</td>
      <td>${p.kisi27 - p.kisi26 > 0 ? '+' : ''}${nf0.format(p.kisi27 - p.kisi26)}</td>
      <td>${para(p.maliyet26)}</td><td>${para(p.maliyet27)}</td><td>${degisim(p.maliyet26, p.maliyet27)}</td></tr></tbody>
    </table></div>
    <p class="ipucu">Oda başına personel: 2026 ${nf2.format(s.personelOdaOrani26)} → 2027 ${nf2.format(s.personelOdaOrani27)} ·
      Personel maliyetinin gelire oranı: 2026 ${yz(s.personelOrani26)} → 2027 ${yz(s.personelOrani27)}</p>`;
  },

  kisiOneri: (s) => {
    const oran = s.hacimOrani;
    return `Satılan oda gecelemesi 2027'de <strong>${degisim(1, oran)}</strong> değişiyor.
      "Doluluğa bağlı" işaretli satırlarda 2027 kişi sayısı boş bırakılırsa bu oranda otomatik önerilir.`;
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
      ${s.odalar.map((o, i) => `<tr><td class="sol">${esc(veri.odalar[i].ad)}</td><td>${nf0.format(o.adet)}</td>
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
const SEKMELER = {
  ozet: () => `${fnAlan('ozet')}`,

  varsayimlar: () => {
    const v = 'varsayimlar';
    const alan = (etiket, girdi, ipucu = '') =>
      `<div class="alan"><label>${etiket}</label>${girdi}${ipucu ? `<p class="ipucu">${ipucu}</p>` : ''}</div>`;
    const enf = veri.varsayimlar.enflasyon;
    return `
    <section class="kart">
      <h2>Otel Bilgileri</h2>
      <p class="aciklama">Sezonluk çalışan oteller açık gün sayısını 365'ten düşük girebilir.</p>
      <div class="form-izgara">
        ${alan('Otel adı', metinGirdi('otel.ad', { cls: 'uzun' }))}
        ${alan('Para birimi', metinGirdi('otel.paraBirimi', { cls: 'kisa' }))}
        ${alan('2026 açık gün sayısı', sayiGirdi('otel.acikGun2026', { min: 0, max: 366 }))}
        ${alan('2027 açık gün sayısı', sayiGirdi('otel.acikGun2027', { min: 0, max: 366, ph: 'Boş = 2026 ile aynı' }))}
      </div>
    </section>
    <section class="kart">
      <h2>2027 Genel Zam Öngörüleri</h2>
      <p class="aciklama">Satırlarda ayrıca bir oran girilmezse bu varsayılanlar kullanılır. Tüm oranlar yüzde (%) olarak girilir.</p>
      <div class="form-izgara">
        ${alan('Genel enflasyon beklentisi (%)', sayiGirdi(`${v}.enflasyon`), 'Kategorisine özel zam girilmeyen giderler ve yan haklar için.')}
        ${alan('Oda fiyatı zammı (%)', sayiGirdi(`${v}.odaFiyatZam`), 'Oda tipinde ayrı zam girilmezse kullanılır.')}
        ${alan('Maaş zammı – Ocak (%)', sayiGirdi(`${v}.ocakZam`), 'Yılın ilk yarısı için.')}
        ${alan('Maaş zammı – Temmuz (%)', sayiGirdi(`${v}.temmuzZam`), 'Ocak zammının üzerine, yılın ikinci yarısı için.')}
        ${alan('SGK işveren payı (%)', sayiGirdi(`${v}.sgkIsveren`), 'İşveren SGK + işsizlik primi. Teşvik varsa düşük girin.')}
        ${alan('Kurumlar vergisi (%)', sayiGirdi(`${v}.kurumlarVergisi`))}
        ${alan('Hedef kâr marjı (%)', sayiGirdi(`${v}.hedefKarMarji`), 'Fiyat Hedefi sekmesinde kullanılır.')}
      </div>
    </section>
    <section class="kart">
      <h2>Gider Kategorilerine Göre 2027 Zamları</h2>
      <p class="aciklama">Kira, elektrik, vergi gibi kalemler için beklediğiniz artışı girin. Boş bırakılanlar genel enflasyonu (%${esc(enf)}) kullanır.</p>
      <div class="form-izgara">
        ${KATEGORILER.map((k) => alan(`${esc(k)} (%)`, sayiGirdi(`${v}.kategoriZam.${k}`, { ph: `Enflasyon (%${enf})`, phEnf: true }))).join('')}
      </div>
    </section>`;
  },

  odalar: () => {
    const v = veri.varsayimlar;
    const satirlar = veri.odalar.map((o, i) => `<tr>
      <td class="sol girdi">${metinGirdi(`odalar.${i}.ad`, { ph: 'Oda tipi', etiket: 'Oda tipi' })}</td>
      <td class="girdi">${sayiGirdi(`odalar.${i}.adet`, { cls: 'kisa', min: 0, etiket: 'Oda adedi' })}</td>
      <td class="girdi">${sayiGirdi(`odalar.${i}.fiyat2026`, { min: 0, etiket: '2026 fiyat' })}</td>
      <td class="girdi">${sayiGirdi(`odalar.${i}.doluluk2026`, { cls: 'kisa', min: 0, max: 100, etiket: '2026 doluluk' })}</td>
      <td class="girdi">${sayiGirdi(`odalar.${i}.fiyatZam`, { cls: 'kisa', ph: `%${v.odaFiyatZam ?? 0}`, etiket: 'Fiyat zammı' })}</td>
      ${cikti(`odalar.${i}.fiyat27`)}
      <td class="girdi">${sayiGirdi(`odalar.${i}.doluluk2027`, { cls: 'kisa', min: 0, max: 100, ph: String(o.doluluk2026 ?? ''), etiket: '2027 doluluk' })}</td>
      ${cikti(`odalar.${i}.satilan26`, 'sayi0')}${cikti(`odalar.${i}.satilan27`, 'sayi0')}
      ${cikti(`odalar.${i}.gelir26`)}${cikti(`odalar.${i}.gelir27`)}
      <td>${silDugme('odalar', i)}</td></tr>`).join('');

    const gelirSatirlari = veri.digerGelirler.map((g, i) => `<tr>
      <td class="sol girdi">${metinGirdi(`digerGelirler.${i}.ad`, { cls: 'uzun', ph: 'Gelir kalemi', etiket: 'Gelir kalemi' })}</td>
      <td class="girdi">${sayiGirdi(`digerGelirler.${i}.tutar2026`, { min: 0, etiket: '2026 tutar' })}</td>
      <td class="sol girdi">${secim(`digerGelirler.${i}.tip`, { sabit: 'Sabit', degisken: 'Dolulukla değişir' }, { etiket: 'Tip' })}</td>
      <td class="girdi">${sayiGirdi(`digerGelirler.${i}.artis`, { cls: 'kisa', ph: `%${v.enflasyon ?? 0}`, etiket: 'Fiyat artışı' })}</td>
      ${cikti(`digerGelirler.${i}.tutar27`)}
      <td>${silDugme('digerGelirler', i)}</td></tr>`).join('');

    return `
    <section class="kart">
      <h2>Oda Tipleri ve Fiyatlar</h2>
      <p class="aciklama">2026 ortalama satış fiyatını (gecelik, KDV hariç) ve doluluğu girin; 2027 için zam ve hedef doluluğu belirleyin.
        Boş bırakılan alanlarda gri yazılı varsayılan kullanılır.</p>
      <div class="kaydir"><table class="tablo">
        <thead><tr>
          <th class="sol">Oda Tipi</th><th>Adet</th><th>Ort. Fiyat<span class="yil">2026</span></th><th>Doluluk %<span class="yil">2026</span></th>
          <th>Fiyat Zammı %<span class="yil">2027</span></th><th>Ort. Fiyat<span class="yil">2027</span></th><th>Doluluk %<span class="yil">2027</span></th>
          <th>Satılan Oda<span class="yil">2026</span></th><th>Satılan Oda<span class="yil">2027</span></th>
          <th>Oda Geliri<span class="yil">2026</span></th><th>Oda Geliri<span class="yil">2027</span></th><th></th>
        </tr></thead>
        <tbody>${satirlar || '<tr><td class="sol bos" colspan="12">Henüz oda tipi yok.</td></tr>'}
          <tr class="toplam"><td class="sol">Toplam</td>${cikti('oda.adet', 'sayi0')}${cikti('oda.adr26')}
            ${cikti('oda.doluluk26', 'yuzde')}<td></td>${cikti('oda.adr27')}${cikti('oda.doluluk27', 'yuzde')}
            ${cikti('oda.satilan26', 'sayi0')}${cikti('oda.satilan27', 'sayi0')}${cikti('oda.gelir26')}${cikti('oda.gelir27')}<td></td></tr>
        </tbody>
      </table></div>
      <button type="button" class="ekle" data-ekle="odalar">+ Oda tipi ekle</button>
      <p class="ipucu">RevPAR (müsait oda başına gelir): 2026 <span data-cikti="oda.revpar26" data-bicim="para"></span> → 2027 <span data-cikti="oda.revpar27" data-bicim="para"></span></p>
    </section>
    <section class="kart">
      <h2>Diğer Gelirler</h2>
      <p class="aciklama">Yiyecek-içecek, SPA, toplantı gibi oda dışı gelirler. "Dolulukla değişir" seçilen kalemler satılan oda sayısıyla orantılı büyür.</p>
      <div class="kaydir"><table class="tablo">
        <thead><tr><th class="sol">Gelir Kalemi</th><th>Tutar<span class="yil">2026</span></th><th class="sol">Tip</th>
          <th>Fiyat Artışı %<span class="yil">2027</span></th><th>Tutar<span class="yil">2027</span></th><th></th></tr></thead>
        <tbody>${gelirSatirlari || '<tr><td class="sol bos" colspan="6">Henüz gelir kalemi yok.</td></tr>'}
          <tr class="toplam"><td class="sol">Toplam</td>${cikti('digerGelir26')}<td></td><td></td>${cikti('digerGelir27')}<td></td></tr>
        </tbody>
      </table></div>
      <button type="button" class="ekle" data-ekle="digerGelirler">+ Gelir kalemi ekle</button>
    </section>`;
  },

  personel: () => {
    const v = veri.varsayimlar;
    const satirlar = veri.personel.map((p, i) => `<tr>
      <td class="sol girdi">${metinGirdi(`personel.${i}.departman`, { ph: 'Departman', etiket: 'Departman' })}</td>
      <td class="sol girdi">${metinGirdi(`personel.${i}.pozisyon`, { ph: 'Pozisyon', etiket: 'Pozisyon' })}</td>
      <td class="girdi">${sayiGirdi(`personel.${i}.kisi2026`, { cls: 'kisa', min: 0, etiket: '2026 kişi' })}</td>
      <td class="girdi">${sayiGirdi(`personel.${i}.kisi2027`, { cls: 'kisa', min: 0, ph: String(sonuc.personel[i]?.onerilenKisi27 ?? ''), etiket: '2027 kişi' })}</td>
      <td class="girdi" style="text-align:center">${kutu(`personel.${i}.dolulugaBagli`, { etiket: 'Doluluğa bağlı' })}</td>
      <td class="girdi">${sayiGirdi(`personel.${i}.maas2026`, { min: 0, etiket: 'Güncel brüt maaş' })}</td>
      <td class="girdi">${sayiGirdi(`personel.${i}.yanHak`, { min: 0, ph: '0', etiket: 'Aylık yan hak' })}</td>
      <td class="girdi">${sayiGirdi(`personel.${i}.ay`, { cls: 'kisa', min: 0, max: 12, ph: '12', etiket: 'Çalışma ayı' })}</td>
      <td class="girdi">${sayiGirdi(`personel.${i}.ocakZam`, { cls: 'kisa', ph: `%${v.ocakZam ?? 0}`, etiket: 'Ocak zammı' })}</td>
      <td class="girdi">${sayiGirdi(`personel.${i}.temmuzZam`, { cls: 'kisa', ph: `%${v.temmuzZam ?? 0}`, etiket: 'Temmuz zammı' })}</td>
      ${cikti(`personel.${i}.kisi27`, 'sayi0')}
      ${cikti(`personel.${i}.maasOcak27`)}${cikti(`personel.${i}.maasTemmuz27`)}
      ${cikti(`personel.${i}.maliyet26`)}${cikti(`personel.${i}.maliyet27`)}
      <td>${silDugme('personel', i)}</td></tr>`).join('');
    return `
    <section class="kart">
      <h2>Personel ve Maaşlar</h2>
      <p class="aciklama">Güncel (2026) brüt aylık maaşı ve kişi sayısını girin. Maliyet = brüt maaş × (1 + SGK işveren payı %${esc(v.sgkIsveren)}) + yan haklar.
        2027'de çalışılan ayların ilk yarısı Ocak zammıyla, ikinci yarısı Ocak + Temmuz zammıyla hesaplanır.</p>
      <p class="aciklama">${fnAlan('kisiOneri', 'span')}</p>
      <div class="kaydir"><table class="tablo">
        <thead><tr>
          <th class="sol">Departman</th><th class="sol">Pozisyon</th><th>Kişi<span class="yil">2026</span></th><th>Kişi (plan)<span class="yil">2027</span></th>
          <th>Doluluğa<span class="yil">bağlı</span></th><th>Brüt Maaş<span class="yil">güncel/ay</span></th><th>Yan Hak<span class="yil">kişi/ay</span></th>
          <th>Çalışma<span class="yil">ay/yıl</span></th><th>Ocak<span class="yil">zam %</span></th><th>Temmuz<span class="yil">zam %</span></th>
          <th>Kişi<span class="yil">2027</span></th><th>Brüt Maaş<span class="yil">Oca 2027</span></th><th>Brüt Maaş<span class="yil">Tem 2027</span></th>
          <th>Yıllık Maliyet<span class="yil">2026</span></th><th>Yıllık Maliyet<span class="yil">2027</span></th><th></th>
        </tr></thead>
        <tbody>${satirlar || '<tr><td class="sol bos" colspan="16">Henüz personel yok.</td></tr>'}
          <tr class="toplam"><td class="sol" colspan="2">Toplam</td>${cikti('personelOzet.kisi26', 'sayi0')}<td colspan="7"></td>
            ${cikti('personelOzet.kisi27', 'sayi0')}<td></td><td></td>${cikti('personelOzet.maliyet26')}${cikti('personelOzet.maliyet27')}<td></td></tr>
        </tbody>
      </table></div>
      <button type="button" class="ekle" data-ekle="personel">+ Personel satırı ekle</button>
    </section>
    <section class="kart">
      <h2>Departman Özeti – Kaç Kişi Çalışacağız?</h2>
      ${fnAlan('departmanlar')}
    </section>`;
  },

  giderler: () => {
    const v = veri.varsayimlar;
    const kategoriler = [...KATEGORILER];
    veri.giderler.forEach((g) => { if (g.kategori && !kategoriler.includes(g.kategori)) kategoriler.push(g.kategori); });
    const katSecenek = Object.fromEntries(kategoriler.map((k) => [k, k]));
    const gruplar = kategoriler.map((kat) => {
      const idxler = veri.giderler.map((g, i) => (g.kategori === kat ? i : -1)).filter((i) => i >= 0);
      const katZam = v.kategoriZam?.[kat];
      const vars = katZam === '' || katZam == null ? v.enflasyon : katZam;
      const satirlar = idxler.map((i) => {
        const g = veri.giderler[i];
        const yuzdeMi = g.tip === 'gelirYuzdesi';
        const orta = yuzdeMi
          ? `<td class="girdi">${sayiGirdi(`giderler.${i}.oran`, { cls: 'kisa', etiket: '2026 oran' })} %</td>
             <td class="girdi">${sayiGirdi(`giderler.${i}.oran2027`, { cls: 'kisa', ph: String(g.oran ?? ''), etiket: '2027 oran' })} %</td>
             <td class="sol girdi">${secim(`giderler.${i}.baz`, { oda: 'Oda gelirinin', toplam: 'Toplam gelirin' }, { etiket: 'Baz' })}</td>`
          : `<td class="girdi">${sayiGirdi(`giderler.${i}.tutar2026`, { min: 0, etiket: '2026 tutar' })}</td>
             <td class="girdi">${sayiGirdi(`giderler.${i}.artis`, { cls: 'kisa', ph: `%${vars ?? 0}`, etiket: '2027 zam' })}</td><td></td>`;
        return `<tr>
          <td class="sol girdi">${metinGirdi(`giderler.${i}.ad`, { cls: 'uzun', ph: 'Gider kalemi', etiket: 'Gider kalemi' })}</td>
          <td class="sol girdi">${secim(`giderler.${i}.tip`, GIDER_TIPLERI, { yeniden: true, etiket: 'Gider tipi' })}</td>
          ${orta}
          ${cikti(`giderler.${i}.tutar26`)}${cikti(`giderler.${i}.tutar27`)}
          <td class="sol girdi">${secim(`giderler.${i}.kategori`, katSecenek, { yeniden: true, etiket: 'Kategori' })}</td>
          <td>${silDugme('giderler', i)}</td></tr>`;
      }).join('');
      return `<div class="gider-grup">
        <div class="gider-grup-baslik"><h3>${esc(kat)}</h3><span class="ipucu">2027 varsayılan zam: %${esc(vars ?? 0)}</span></div>
        ${idxler.length ? `<div class="kaydir"><table class="tablo gider-tablo"><colgroup>
          <col style="width:20%"><col style="width:17%"><col style="width:11%"><col style="width:10%"><col style="width:11%">
          <col style="width:10%"><col style="width:10%"><col style="width:16%"><col style="width:40px"></colgroup><thead><tr>
          <th class="sol">Gider Kalemi</th><th class="sol">Tip</th><th>Tutar / Oran<span class="yil">2026</span></th>
          <th>Zam % / Oran<span class="yil">2027</span></th><th class="sol">Baz</th>
          <th>Tutar<span class="yil">2026</span></th><th>Tutar<span class="yil">2027</span></th><th class="sol">Kategori</th><th></th>
        </tr></thead><tbody>${satirlar}</tbody></table></div>` : '<p class="bos">Bu kategoride kalem yok.</p>'}
        <button type="button" class="ekle" data-ekle="giderler" data-kategori="${esc(kat)}">+ ${esc(kat)} kalemi ekle</button>
      </div>`;
    }).join('');
    return `
    <section class="kart">
      <h2>Giderler (Personel hariç)</h2>
      <p class="aciklama"><strong>Sabit</strong>: yıllık tutar, zam oranı kadar artar (kira, sigorta).
        <strong>Değişken</strong>: satılan oda sayısıyla orantılı değişir, üstüne zam eklenir (elektrik, su, yiyecek maliyeti).
        <strong>Gelirin yüzdesi</strong>: gelire oranla hesaplanır (konaklama vergisi, acente komisyonu).
        Zam kutusu boş bırakılırsa kategori zammı, o da yoksa genel enflasyon kullanılır.</p>
      ${gruplar}
      <table class="tablo" style="margin-top:16px"><tbody>
        <tr class="toplam"><td class="sol">Toplam Gider (personel hariç)</td><td>2026: <span data-cikti="gider26" data-bicim="para"></span></td>
        <td>2027: <span data-cikti="gider27" data-bicim="para"></span></td></tr>
      </tbody></table>
    </section>`;
  },

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
            <tr><td class="sol">Oda sayısı</td><td>${nf0.format(s.oda.adet)}</td><td>${nf0.format(s.oda.adet)}</td><td></td></tr>
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

function sekmeCiz() {
  document.querySelectorAll('[data-sekme]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.sekme === aktifSekme)));
  sonuc = hesapla(veri);
  $icerik.innerHTML = (SEKMELER[aktifSekme] || SEKMELER.ozet)();
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

document.addEventListener('input', (e) => {
  const el = e.target.closest('[data-yol]');
  if (el && el.tagName === 'INPUT' && el.type !== 'checkbox') girdiDegisti(el);
});
document.addEventListener('change', (e) => {
  const el = e.target.closest('[data-yol]');
  if (el && (el.tagName === 'SELECT' || el.type === 'checkbox')) girdiDegisti(el);
});

const YENI_SATIR = {
  odalar: () => ({ id: yeniId(), ad: '', adet: 0, fiyat2026: 0, doluluk2026: 0, fiyatZam: '', doluluk2027: '' }),
  digerGelirler: () => ({ id: yeniId(), ad: '', tutar2026: 0, tip: 'sabit', artis: '' }),
  personel: () => ({ id: yeniId(), departman: '', pozisyon: '', kisi2026: 1, kisi2027: '', maas2026: 0, ay: 12, yanHak: '', dolulugaBagli: false }),
  giderler: (kategori) => ({ id: yeniId(), kategori: kategori || 'Diğer Giderler', ad: '', tip: 'sabit', tutar2026: 0, artis: '', baz: 'oda', oran: 0, oran2027: '' }),
};

document.addEventListener('click', async (e) => {
  const sekme = e.target.closest('[data-sekme]');
  if (sekme) {
    aktifSekme = sekme.dataset.sekme;
    try { localStorage.setItem('aktifSekme', aktifSekme); } catch { /* yok say */ }
    sekmeCiz();
    return;
  }
  const ekle = e.target.closest('[data-ekle]');
  if (ekle) {
    const liste = ekle.dataset.ekle;
    veri[liste].push(YENI_SATIR[liste](ekle.dataset.kategori));
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
  veri.odalar.forEach((o, i) => {
    const r = s.odalar[i];
    ekle(o.ad, r.adet, r.fiyat26, r.doluluk26 * 100, r.fiyat27, r.doluluk27 * 100, r.satilan26, r.satilan27, r.gelir26, r.gelir27, s.hedef.odaFiyatlari[i].hedef27 ?? '');
  });
  ekle();
  ekle('PERSONEL', 'Pozisyon', 'Kişi 2026', 'Kişi 2027', 'Brüt Maaş Güncel', 'Brüt Maaş Oca 2027', 'Brüt Maaş Tem 2027', 'Çalışma Ayı', 'Maliyet 2026', 'Maliyet 2027');
  veri.personel.forEach((p, i) => {
    const r = s.personel[i];
    ekle(p.departman, p.pozisyon, r.kisi26, r.kisi27, r.maas26, r.maasOcak27, r.maasTemmuz27, r.ay, r.maliyet26, r.maliyet27);
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
