import { bosNetVeri, netTablo, netHesapla, gerekenSatis } from './net-fiyat-calc.js';

let veri = bosNetVeri();
let sonuc = netTablo(veri);
let hedefNet = '';

// ---------------- Biçimlendirme ----------------
const nf2 = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nf1 = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const pb = () => veri.ayarlar.paraBirimi || '€';
const gecerli = (x) => x !== null && x !== undefined && Number.isFinite(x);
const para = (x) => (gecerli(x) ? `${nf2.format(x)} ${pb()}` : '—');
const yz = (x) => (gecerli(x) ? `%${nf1.format(x * 100)}` : '—');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const yeniId = () => Math.random().toString(36).slice(2, 10);
const BICIMLER = { para, yuzde: yz, eksi: (x) => (gecerli(x) && x ? `− ${para(x)}` : para(x)) };

function yolOku(nesne, yol) {
  return yol.split('.').reduce((o, k) => (o == null ? undefined : o[k]), nesne);
}
function yolYaz(nesne, yol, deger) {
  const p = yol.split('.');
  const son = p.pop();
  const o = p.reduce((x, k) => (x[k] ??= {}), nesne);
  o[son] = deger;
}

function sayiGirdi(yol, o = {}) {
  return `<input type="number" step="any" data-yol="${esc(yol)}" data-tip="sayi" class="${o.cls || ''}"
    value="${esc(yolOku(veri, yol) ?? '')}" placeholder="${esc(o.ph ?? '')}" ${o.min !== undefined ? `min="${o.min}"` : ''}
    ${o.max !== undefined ? `max="${o.max}"` : ''} aria-label="${esc(o.etiket || yol)}"${o.yeniden ? ' data-yeniden="1"' : ''}>`;
}
function metinGirdi(yol, o = {}) {
  return `<input type="text" data-yol="${esc(yol)}" data-tip="metin" class="${o.cls || ''}"
    value="${esc(yolOku(veri, yol) ?? '')}" placeholder="${esc(o.ph ?? '')}" aria-label="${esc(o.etiket || yol)}"${o.yeniden ? ' data-yeniden="1"' : ''}>`;
}
const cikti = (yol, bicim = 'para', cls = '') => `<td class="cikti ${cls}" data-cikti="${yol}" data-bicim="${bicim}"></td>`;
const alan = (etiket, girdi, ipucu = '') =>
  `<div class="alan"><label>${etiket}</label>${girdi}${ipucu ? `<p class="ipucu">${ipucu}</p>` : ''}</div>`;

// ---------------- Canlı alanlar ----------------
const FN = {
  kpi: (s) => {
    const a = veri.ayarlar;
    const k = (etiket, deger, alt = '') =>
      `<div class="kpi"><div class="etiket">${etiket}</div><div class="deger">${deger}</div><div class="fark">${alt}</div></div>`;
    const ornek = netHesapla(100, a.erkenRez, a.komisyon);
    return [
      k('Erken Rezervasyon', `%${nf1.format(Number(a.erkenRez) || 0)}`, 'Önce düşülür'),
      k('Acente Komisyonu', `%${nf1.format(Number(a.komisyon) || 0)}`, 'Sonra düşülür'),
      k('Toplam kesinti', yz(ornek.toplamKesinti), `100 satıştan ${nf2.format(ornek.net)} net kalır`),
      k('Ort. satış (kişi başı)', para(s.ortalama.satis), `Oda (${s.kisi} kişi): ${para(s.ortalama.odaSatis)}`),
      k('Ort. NET (kişi başı)', para(s.ortalama.net), `Oda (${s.kisi} kişi): ${para(s.ortalama.odaNet)}`),
    ].join('');
  },
  ornek: () => {
    const a = veri.ayarlar;
    const r = netHesapla(100, a.erkenRez, a.komisyon);
    return `<div class="akis">
      <span class="adim"><small>Satış fiyatı</small><strong>100,00</strong></span>
      <span class="ok">− %${nf1.format(Number(a.erkenRez) || 0)} Erken Rez.</span>
      <span class="adim"><small>İndirimli</small><strong>${nf2.format(r.ebSonrasi)}</strong></span>
      <span class="ok">− %${nf1.format(Number(a.komisyon) || 0)} Komisyon</span>
      <span class="adim vurgulu"><small>NET</small><strong>${nf2.format(r.net)}</strong></span>
    </div>
    <p class="ipucu">Komisyon, indirimli fiyat üzerinden hesaplanır. Toplam kesinti ${yz(r.toplamKesinti)}
      (indirim + komisyon oranlarının toplamı değildir).</p>`;
  },
  tersHesap: () => {
    const a = veri.ayarlar;
    const s = gerekenSatis(hedefNet, a.erkenRez, a.komisyon);
    const kisi = sonuc.kisi;
    if (hedefNet === '' || s === null) return '<p class="ipucu">Kişi başı hedef net fiyatı yazın.</p>';
    return `<div class="kpi-izgara">
      <div class="kpi-kart vurgulu"><div class="etiket">Gereken satış fiyatı (kişi başı)</div><div class="deger">${para(s)}</div></div>
      <div class="kpi-kart"><div class="etiket">Gereken satış fiyatı (oda, ${kisi} kişi)</div><div class="deger">${para(s * kisi)}</div></div>
      <div class="kpi-kart"><div class="etiket">Hedef net (oda, ${kisi} kişi)</div><div class="deger">${para(Number(hedefNet) * kisi)}</div></div>
    </div>`;
  },
};

// ---------------- Sayfa ----------------
function sayfa() {
  const a = veri.ayarlar;
  const kisi = sonuc.kisi;
  const satirlar = veri.fiyatlar.map((f, i) => `<tr>
    <td class="sol girdi">${metinGirdi(`fiyatlar.${i}.donem`, { ph: 'ör. 15.05 – 31.05', etiket: 'Dönem' })}</td>
    <td class="sol girdi">${metinGirdi(`fiyatlar.${i}.odaTipi`, { ph: 'ör. Standart Oda', etiket: 'Oda tipi' })}</td>
    <td class="girdi">${sayiGirdi(`fiyatlar.${i}.fiyat`, { min: 0, etiket: 'Kişi başı satış fiyatı' })}</td>
    <td class="girdi">${sayiGirdi(`fiyatlar.${i}.erkenRez`, { cls: 'kisa', min: 0, max: 100, ph: `%${a.erkenRez || 0}`, etiket: 'Erken rezervasyon %' })}</td>
    ${cikti(`satirlar.${i}.ebIndirim`, 'eksi')}${cikti(`satirlar.${i}.ebSonrasi`)}
    ${cikti(`satirlar.${i}.komisyon`, 'eksi')}${cikti(`satirlar.${i}.net`, 'para', 'net-hucre')}
    ${cikti(`satirlar.${i}.odaSatis`)}${cikti(`satirlar.${i}.odaNet`, 'para', 'net-hucre')}
    ${cikti(`satirlar.${i}.toplamKesinti`, 'yuzde')}
    <td><button type="button" class="sil" data-kopyala="${i}" title="Satırı kopyala" aria-label="Satırı kopyala">⧉</button>
      <button type="button" class="sil" data-sil="${i}" title="Satırı sil" aria-label="Satırı sil">✕</button></td></tr>`).join('');

  return `
  <section class="kart">
    <h2>Oranlar</h2>
    <p class="aciklama">Fiyatlar <strong>kişi başı</strong> ve <strong>komisyon dahil satış fiyatı</strong> olarak girilir.
      Net fiyat için önce Erken Rezervasyon indirimi, sonra acente komisyonu düşülür.</p>
    <div class="form-izgara">
      ${alan('Acente komisyonu (%)', sayiGirdi('ayarlar.komisyon', { min: 0, max: 100 }), 'Acentelerin ortalama komisyonu.')}
      ${alan('Erken Rezervasyon indirimi (%)', sayiGirdi('ayarlar.erkenRez', { min: 0, max: 100, ph: '0' }), 'Dönem satırında ayrı oran girilmezse bu kullanılır.')}
      ${alan('Oda hesabı kaç kişi üzerinden?', sayiGirdi('ayarlar.kisi', { min: 1, ph: '2', yeniden: true }), 'Odalar ortalama 3 kişilik olsa da oda fiyatı 2 kişi üzerinden hesaplanır.')}
      ${alan('Para birimi', metinGirdi('ayarlar.paraBirimi', { cls: 'kisa' }))}
    </div>
    <div data-fn="ornek"></div>
  </section>

  <section class="kart">
    <h2>Fiyat Listesi</h2>
    <p class="aciklama">Her dönem ve oda tipi için kişi başı gecelik satış fiyatını yazın. Yeşil sütunlar otele kalan net tutarlardır.</p>
    <div class="kaydir"><table class="tablo net-tablo">
      <thead><tr>
        <th class="sol">Dönem</th><th class="sol">Oda Tipi</th><th>Satış Fiyatı<span class="yil">kişi başı</span></th>
        <th>Erken Rez.<span class="yil">%</span></th><th>Erken Rez.<span class="yil">indirimi</span></th><th>İndirimli<span class="yil">kişi başı</span></th>
        <th>Komisyon<span class="yil">%${nf1.format(Number(a.komisyon) || 0)}</span></th><th>NET<span class="yil">kişi başı</span></th>
        <th>Satış<span class="yil">oda, ${kisi} kişi</span></th><th>NET<span class="yil">oda, ${kisi} kişi</span></th>
        <th>Toplam<span class="yil">kesinti</span></th><th></th>
      </tr></thead>
      <tbody>${satirlar || '<tr><td class="sol bos" colspan="12">Henüz fiyat yok. Aşağıdan ekleyin.</td></tr>'}
        <tr class="toplam"><td class="sol" colspan="2">Ortalama</td>${cikti('ortalama.satis')}<td></td><td></td><td></td><td></td>
          ${cikti('ortalama.net', 'para', 'net-hucre')}${cikti('ortalama.odaSatis')}${cikti('ortalama.odaNet', 'para', 'net-hucre')}
          ${cikti('ortalama.toplamKesinti', 'yuzde')}<td></td></tr>
      </tbody>
    </table></div>
    <button type="button" class="ekle" data-ekle="1">+ Fiyat satırı ekle</button>
  </section>

  <section class="kart">
    <h2>Ters Hesap – Net Hedefe Göre Satış Fiyatı</h2>
    <p class="aciklama">Otele kişi başı kalmasını istediğiniz net tutarı yazın; mevcut Erken Rezervasyon ve komisyon oranlarıyla satış fiyatının ne olması gerektiğini gösterir.</p>
    <div class="form-izgara" style="margin-bottom:12px">
      ${alan(`Hedef NET fiyat (kişi başı, ${esc(pb())})`, `<input type="number" step="any" min="0" id="hedef-net" value="${esc(hedefNet)}" aria-label="Hedef net fiyat">`)}
    </div>
    <div data-fn="tersHesap"></div>
  </section>`;
}

const $icerik = document.getElementById('icerik');
function ciz() {
  sonuc = netTablo(veri);
  $icerik.innerHTML = sayfa();
  yaz();
}
function yaz() {
  sonuc = netTablo(veri);
  document.getElementById('baslik').textContent = veri.ayarlar.baslik || 'Net Oda Fiyatları';
  document.getElementById('kpi-serit').innerHTML = FN.kpi(sonuc);
  document.querySelectorAll('[data-cikti]').forEach((el) => {
    el.textContent = (BICIMLER[el.dataset.bicim] || para)(yolOku(sonuc, el.dataset.cikti));
  });
  document.querySelectorAll('[data-fn]').forEach((el) => { el.innerHTML = FN[el.dataset.fn](sonuc); });
}

// ---------------- Kaydetme ----------------
const $durum = document.getElementById('kayit-durumu');
let zamanlayici = null;
function durum(metin, hata = false) {
  $durum.textContent = metin;
  $durum.classList.toggle('hata', hata);
}
function kaydetPlanla() {
  durum('Kaydediliyor…');
  clearTimeout(zamanlayici);
  zamanlayici = setTimeout(async () => {
    try {
      const y = await fetch('/api/net-fiyat', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(veri),
      });
      if (!y.ok) throw new Error();
      durum(`Kaydedildi ✓ ${new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`);
    } catch {
      durum('Kaydedilemedi! Sunucu çalışıyor mu?', true);
    }
  }, 500);
}

// ---------------- Olaylar ----------------
document.addEventListener('input', (e) => {
  if (e.target.id === 'hedef-net') {
    hedefNet = e.target.value;
    yaz();
    return;
  }
  const el = e.target.closest('[data-yol]');
  if (!el) return;
  const deger = el.dataset.tip === 'sayi' ? (el.value === '' ? '' : Number(el.value)) : el.value;
  yolYaz(veri, el.dataset.yol, deger);
  if (el.dataset.yeniden) ciz();
  else yaz();
  kaydetPlanla();
});

document.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.ekle) {
    const onceki = veri.fiyatlar[veri.fiyatlar.length - 1];
    veri.fiyatlar.push({ id: yeniId(), donem: onceki?.donem || '', odaTipi: '', fiyat: '', erkenRez: '' });
    ciz();
    kaydetPlanla();
    document.querySelector(`[data-yol="fiyatlar.${veri.fiyatlar.length - 1}.odaTipi"]`)?.focus();
  } else if (b.dataset.kopyala !== undefined) {
    const i = Number(b.dataset.kopyala);
    veri.fiyatlar.splice(i + 1, 0, { ...veri.fiyatlar[i], id: yeniId() });
    ciz();
    kaydetPlanla();
  } else if (b.dataset.sil !== undefined) {
    const i = Number(b.dataset.sil);
    const f = veri.fiyatlar[i];
    if (!confirm(`"${[f.donem, f.odaTipi].filter(Boolean).join(' – ') || 'Bu satır'}" silinsin mi?`)) return;
    veri.fiyatlar.splice(i, 1);
    ciz();
    kaydetPlanla();
  } else if (b.dataset.islem === 'yazdir') {
    window.print();
  } else if (b.dataset.islem === 'csv') {
    csvIndir();
  }
});

function csvIndir() {
  const hucre = (x) => {
    if (typeof x === 'number') return Number.isFinite(x) ? String(Math.round(x * 100) / 100).replace('.', ',') : '';
    const m = String(x ?? '');
    return /[;"\n]/.test(m) ? `"${m.replace(/"/g, '""')}"` : m;
  };
  const a = veri.ayarlar;
  const k = sonuc.kisi;
  const satir = (...h) => h.map(hucre).join(';');
  const satirlar = [
    satir(veri.ayarlar.baslik || 'Net Oda Fiyatları'),
    satir('Acente komisyonu %', Number(a.komisyon) || 0),
    satir('Erken Rezervasyon %', Number(a.erkenRez) || 0),
    satir('Para birimi', pb()),
    '',
    satir('Dönem', 'Oda Tipi', 'Satış (kişi)', 'Erken Rez. %', 'Erken Rez. indirimi', 'İndirimli (kişi)', 'Komisyon',
      'NET (kişi)', `Satış (oda, ${k} kişi)`, `NET (oda, ${k} kişi)`, 'Toplam kesinti %'),
    ...veri.fiyatlar.map((f, i) => {
      const r = sonuc.satirlar[i];
      return satir(f.donem, f.odaTipi, r.satis, r.eb, r.ebIndirim, r.ebSonrasi, r.komisyon, r.net, r.odaSatis, r.odaNet, r.toplamKesinti * 100);
    }),
  ];
  const url = URL.createObjectURL(new Blob(['﻿' + satirlar.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
  const link = Object.assign(document.createElement('a'), { href: url, download: 'net-oda-fiyatlari.csv' });
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------------- Başlangıç ----------------
(async function baslat() {
  try {
    const y = await fetch('/api/net-fiyat');
    const gelen = await y.json();
    const temel = bosNetVeri();
    veri = { ...temel, ...gelen, ayarlar: { ...temel.ayarlar, ...(gelen.ayarlar || {}) } };
    if (!Array.isArray(veri.fiyatlar)) veri.fiyatlar = [];
    durum('Veriler yüklendi');
  } catch {
    durum('Sunucuya bağlanılamadı', true);
  }
  if (!veri.fiyatlar.length) veri.fiyatlar.push({ id: yeniId(), donem: '', odaTipi: '', fiyat: '', erkenRez: '' });
  ciz();
})();
