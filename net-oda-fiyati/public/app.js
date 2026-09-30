import {
  bosListe, depoHazirla, netTablo, netHesapla, gerekenSatis, aktifKur, tcmbKurlariniOku, DOVIZLER,
} from './hesap.js';

// depo: kayıtlı tüm fiyat listeleri; veri: açık olan liste
let depo = depoHazirla({});
let veri = depo.listeler[0];
let sonuc = netTablo(veri);
let hedefNet = '';

// ---------------- Biçimlendirme ----------------
const nf2 = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nf1 = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const nf4 = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
const gecerli = (x) => x !== null && x !== undefined && Number.isFinite(x);
const tl = (x) => (gecerli(x) ? `${nf2.format(x)} ₺` : '—');
const dvz = (x) => (gecerli(x) ? `${nf2.format(x)} ${DOVIZLER[veri.ayarlar.doviz] || ''}` : '—');
const yz = (x) => (gecerli(x) ? `%${nf1.format(x * 100)}` : '—');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const yeniId = () => Math.random().toString(36).slice(2, 10);
const tarihSaat = (iso) => (iso ? new Date(iso).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' }) : '');
const BICIMLER = { tl, dvz, yuzde: yz, eksi: (x) => (gecerli(x) && x ? `− ${tl(x)}` : tl(x)) };
const dovizVar = () => aktifKur(veri.ayarlar) !== null;

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
function secim(yol, secenekler, o = {}) {
  const deger = yolOku(veri, yol) ?? '';
  return `<select data-yol="${esc(yol)}" data-tip="metin" data-yeniden="1" aria-label="${esc(o.etiket || yol)}">${Object.entries(secenekler)
    .map(([k, ad]) => `<option value="${esc(k)}"${k === deger ? ' selected' : ''}>${esc(ad)}</option>`).join('')}</select>`;
}
const cikti = (yol, bicim = 'tl', cls = '') => `<td class="cikti ${cls}" data-cikti="${yol}" data-bicim="${bicim}"></td>`;
const alan = (etiket, girdi, ipucu = '') =>
  `<div class="alan"><label>${etiket}</label>${girdi}${ipucu ? `<p class="ipucu">${ipucu}</p>` : ''}</div>`;

// ---------------- Canlı alanlar ----------------
const FN = {
  kpi: (s) => {
    const a = veri.ayarlar;
    const k = (etiket, deger, alt = '') =>
      `<div class="kpi"><div class="etiket">${etiket}</div><div class="deger">${deger}</div><div class="fark">${alt}</div></div>`;
    const ornek = netHesapla(100, a.erkenRez, a.komisyon);
    const d = dovizVar();
    return [
      k('Erken Rezervasyon', `%${nf1.format(Number(a.erkenRez) || 0)}`, 'Önce düşülür'),
      k('Acente Komisyonu', `%${nf1.format(Number(a.komisyon) || 0)}`, 'Sonra düşülür'),
      k('Toplam kesinti', yz(ornek.toplamKesinti), `100 ₺ satıştan ${nf2.format(ornek.net)} ₺ net kalır`),
      k('Ort. NET (kişi başı)', tl(s.ortalama.net), d ? dvz(s.ortalama.dNet) : `Satış ${tl(s.ortalama.satis)}`),
      k(`Ort. NET (oda, ${s.kisi} kişi)`, tl(s.ortalama.odaNet), d ? dvz(s.ortalama.dOdaNet) : `Satış ${tl(s.ortalama.odaSatis)}`),
    ].join('');
  },
  ornek: () => {
    const a = veri.ayarlar;
    const r = netHesapla(100, a.erkenRez, a.komisyon);
    return `<div class="akis">
      <span class="adim"><small>Satış fiyatı</small><strong>100,00 ₺</strong></span>
      <span class="ok">%${nf1.format(Number(a.erkenRez) || 0)} Erken Rez. düşülür</span>
      <span class="adim"><small>İndirimli</small><strong>${nf2.format(r.ebSonrasi)} ₺</strong></span>
      <span class="ok">%${nf1.format(Number(a.komisyon) || 0)} Komisyon düşülür</span>
      <span class="adim vurgulu"><small>NET</small><strong>${nf2.format(r.net)} ₺</strong></span>
    </div>
    <p class="ipucu">Komisyon, indirimli fiyat üzerinden hesaplanır. Toplam kesinti ${yz(r.toplamKesinti)}
      (indirim ve komisyon oranlarının toplamı değildir).</p>`;
  },
  tersHesap: () => {
    const a = veri.ayarlar;
    const s = gerekenSatis(hedefNet, a.erkenRez, a.komisyon);
    const kisi = sonuc.kisi;
    const kur = aktifKur(a);
    if (hedefNet === '' || s === null) return '<p class="ipucu">Kişi başı hedef net fiyatı (TL) yazın.</p>';
    const alt = (x) => (kur ? dvz(x / kur) : '');
    return `<div class="kpi-izgara">
      <div class="kpi-kart vurgulu"><div class="etiket">Gereken satış fiyatı (kişi başı)</div><div class="deger">${tl(s)}</div><div class="fark">${alt(s)}</div></div>
      <div class="kpi-kart"><div class="etiket">Gereken satış fiyatı (oda, ${kisi} kişi)</div><div class="deger">${tl(s * kisi)}</div><div class="fark">${alt(s * kisi)}</div></div>
      <div class="kpi-kart"><div class="etiket">Hedef net (oda, ${kisi} kişi)</div><div class="deger">${tl(Number(hedefNet) * kisi)}</div><div class="fark">${alt(Number(hedefNet) * kisi)}</div></div>
    </div>`;
  },
  listeler: () => {
    const satirlar = [...depo.listeler]
      .sort((a, b) => (b.guncelleme || '').localeCompare(a.guncelleme || ''))
      .map((l) => {
        const acik = l.id === veri.id;
        return `<tr class="${acik ? 'acik-liste' : ''}">
          <td class="sol">${acik ? '<strong>▶ ' : ''}${esc(l.ad || 'Adsız liste')}${acik ? '</strong>' : ''}</td>
          <td>${l.fiyatlar.filter((f) => Number(f.fiyat) > 0).length}</td>
          <td>%${nf1.format(Number(l.ayarlar.komisyon) || 0)} / %${nf1.format(Number(l.ayarlar.erkenRez) || 0)}</td>
          <td>${esc(tarihSaat(l.guncelleme))}</td>
          <td>${acik ? '<span class="ipucu">Açık</span>' : `<button type="button" data-ac="${l.id}">Aç</button>`}</td></tr>`;
      }).join('');
    return `<div class="kaydir"><table class="tablo"><thead><tr><th class="sol">Liste adı</th><th>Fiyat satırı</th>
      <th>Komisyon / Erken Rez.</th><th>Son değişiklik</th><th></th></tr></thead><tbody>${satirlar}</tbody></table></div>`;
  },
  rapor: (s) => raporHtml(s),
};

// ---------------- Sayfa ----------------
function sayfa() {
  const a = veri.ayarlar;
  const kisi = sonuc.kisi;
  // Döviz seçildiyse sütunlar hemen görünür; kur girilene kadar "—" yazar.
  const d = !!a.doviz;
  const sembol = DOVIZLER[a.doviz] || '';
  const satirlar = veri.fiyatlar.map((f, i) => `<tr>
    <td class="sol girdi">${metinGirdi(`fiyatlar.${i}.donem`, { ph: 'ör. 15.05 – 31.05', etiket: 'Dönem' })}</td>
    <td class="sol girdi">${metinGirdi(`fiyatlar.${i}.odaTipi`, { ph: 'ör. Standart Oda', etiket: 'Oda tipi' })}</td>
    <td class="girdi">${sayiGirdi(`fiyatlar.${i}.fiyat`, { min: 0, etiket: 'Kişi başı satış fiyatı (TL)' })}</td>
    <td class="girdi">${sayiGirdi(`fiyatlar.${i}.erkenRez`, { cls: 'kisa', min: 0, max: 100, ph: `%${a.erkenRez || 0}`, etiket: 'Erken rezervasyon %' })}</td>
    ${cikti(`satirlar.${i}.ebIndirim`, 'eksi')}${cikti(`satirlar.${i}.ebSonrasi`)}
    ${cikti(`satirlar.${i}.komisyon`, 'eksi')}${cikti(`satirlar.${i}.net`, 'tl', 'net-hucre')}
    ${cikti(`satirlar.${i}.odaSatis`)}${cikti(`satirlar.${i}.odaNet`, 'tl', 'net-hucre')}
    ${d ? cikti(`satirlar.${i}.dNet`, 'dvz', 'doviz-hucre') + cikti(`satirlar.${i}.dOdaNet`, 'dvz', 'doviz-hucre') : ''}
    ${cikti(`satirlar.${i}.toplamKesinti`, 'yuzde')}
    <td><button type="button" class="sil" data-kopyala="${i}" title="Satırı kopyala" aria-label="Satırı kopyala">⧉</button>
      <button type="button" class="sil" data-sil="${i}" title="Satırı sil" aria-label="Satırı sil">✕</button></td></tr>`).join('');
  const dovizSec = { '': 'Yok (sadece TL)', EUR: 'Euro (€)', USD: 'Dolar ($)', GBP: 'Sterlin (£)' };

  return `
  <section class="kart">
    <div class="gider-grup-baslik">
      <h2>Kayıtlı Fiyat Listeleri</h2>
      <div class="araclar">
        <button type="button" data-liste="yeni">+ Yeni liste</button>
        <button type="button" data-liste="kopya">Bu listenin kopyası</button>
        <button type="button" data-liste="sil">Bu listeyi sil</button>
      </div>
    </div>
    <p class="aciklama">Her liste ayrı kaydedilir (ör. "2027 Yaz – Acenteler", "2027 Erken Rezervasyon"). Değişiklikler otomatik kaydedilir; istediğiniz zaman açıp bakabilirsiniz.</p>
    <div class="form-izgara" style="margin-bottom:12px">
      ${alan('Açık listenin adı', `<input type="text" id="liste-adi" class="uzun" value="${esc(veri.ad)}" aria-label="Liste adı">`)}
    </div>
    <div data-fn="listeler"></div>
  </section>

  <section class="kart">
    <h2>Oranlar</h2>
    <p class="aciklama">Fiyatlar <strong>TL</strong>, <strong>kişi başı</strong> ve <strong>komisyon dahil satış fiyatı</strong> olarak girilir.
      Net fiyat için önce Erken Rezervasyon indirimi, sonra acente komisyonu düşülür.</p>
    <div class="form-izgara">
      ${alan('Acente komisyonu (%)', sayiGirdi('ayarlar.komisyon', { min: 0, max: 100 }), 'Acentelerin ortalama komisyonu.')}
      ${alan('Erken Rezervasyon indirimi (%)', sayiGirdi('ayarlar.erkenRez', { min: 0, max: 100, ph: '0' }), 'Dönem satırında ayrı oran girilmezse bu kullanılır.')}
      ${alan('Oda hesabı kaç kişi üzerinden?', sayiGirdi('ayarlar.kisi', { min: 1, ph: '2', yeniden: true }), 'Odalar ortalama 3 kişilik olsa da oda fiyatı 2 kişi üzerinden hesaplanır.')}
    </div>
    <div data-fn="ornek"></div>
  </section>

  <section class="kart">
    <h2>Döviz Çevirisi (isteğe bağlı)</h2>
    <p class="aciklama">Hesap TL yapılır. Döviz seçerseniz net fiyatların döviz karşılığı da gösterilir (TL ÷ kur).</p>
    <div class="form-izgara">
      ${alan('Döviz', secim('ayarlar.doviz', dovizSec, { etiket: 'Döviz' }))}
      ${a.doviz ? alan(`1 ${a.doviz} = kaç TL?`, sayiGirdi(`ayarlar.kurlar.${a.doviz}`, { min: 0, ph: 'ör. 48,50' }),
        `<button type="button" data-kur="tcmb">TCMB kurlarını getir</button> <span id="kur-durum"></span>`) : ''}
      ${a.doviz ? alan('Kur tarihi / notu', metinGirdi('ayarlar.kurTarihi', { ph: 'ör. 30.09.2026 TCMB döviz alış' })) : ''}
    </div>
  </section>

  <section class="kart">
    <h2>Fiyat Listesi</h2>
    <p class="aciklama">Her dönem ve oda tipi için kişi başı gecelik satış fiyatını TL olarak yazın. Yeşil sütunlar otele kalan net tutarlardır.</p>
    <div class="kaydir"><table class="tablo net-tablo">
      <thead><tr>
        <th class="sol">Dönem</th><th class="sol">Oda Tipi</th><th>Satış Fiyatı<span class="yil">kişi başı, TL</span></th>
        <th>Erken Rez.<span class="yil">%</span></th><th>Erken Rez.<span class="yil">indirimi</span></th><th>İndirimli<span class="yil">kişi başı</span></th>
        <th>Komisyon<span class="yil">%${nf1.format(Number(a.komisyon) || 0)}</span></th><th>NET<span class="yil">kişi başı</span></th>
        <th>Satış<span class="yil">oda, ${kisi} kişi</span></th><th>NET<span class="yil">oda, ${kisi} kişi</span></th>
        ${d ? `<th>NET ${sembol}<span class="yil">kişi başı</span></th><th>NET ${sembol}<span class="yil">oda, ${kisi} kişi</span></th>` : ''}
        <th>Toplam<span class="yil">kesinti</span></th><th></th>
      </tr></thead>
      <tbody>${satirlar || `<tr><td class="sol bos" colspan="${d ? 14 : 12}">Henüz fiyat yok. Aşağıdan ekleyin.</td></tr>`}
        <tr class="toplam"><td class="sol" colspan="2">Ortalama</td>${cikti('ortalama.satis')}<td></td><td></td><td></td><td></td>
          ${cikti('ortalama.net', 'tl', 'net-hucre')}${cikti('ortalama.odaSatis')}${cikti('ortalama.odaNet', 'tl', 'net-hucre')}
          ${d ? cikti('ortalama.dNet', 'dvz', 'doviz-hucre') + cikti('ortalama.dOdaNet', 'dvz', 'doviz-hucre') : ''}
          ${cikti('ortalama.toplamKesinti', 'yuzde')}<td></td></tr>
      </tbody>
    </table></div>
    <button type="button" class="ekle" data-ekle="1">+ Fiyat satırı ekle</button>
  </section>

  <section class="kart">
    <h2>Ters Hesap – Net Hedefe Göre Satış Fiyatı</h2>
    <p class="aciklama">Otele kişi başı kalmasını istediğiniz net tutarı (TL) yazın; mevcut Erken Rezervasyon ve komisyon oranlarıyla satış fiyatının ne olması gerektiğini gösterir.</p>
    <div class="form-izgara" style="margin-bottom:12px">
      ${alan('Hedef NET fiyat (kişi başı, TL)', `<input type="number" step="any" min="0" id="hedef-net" value="${esc(hedefNet)}" aria-label="Hedef net fiyat">`)}
    </div>
    <div data-fn="tersHesap"></div>
  </section>`;
}

// PDF / yazdırma için sade rapor (ekranda gizli)
function raporHtml(s) {
  const a = veri.ayarlar;
  const d = dovizVar();
  const sembol = DOVIZLER[a.doviz] || '';
  const dolu = veri.fiyatlar.map((f, i) => ({ f, r: s.satirlar[i] })).filter((x) => x.r.satis > 0);
  return `
    <div class="rapor-baslik">
      <div><h1>${esc(veri.ad || 'Net Oda Fiyatları')}</h1>
        <p>Acente komisyonu %${nf1.format(Number(a.komisyon) || 0)} · Erken Rezervasyon %${nf1.format(Number(a.erkenRez) || 0)}
          · Oda fiyatı ${s.kisi} kişi üzerinden${d ? ` · 1 ${a.doviz} = ${nf4.format(s.kur)} ₺${a.kurTarihi ? ` (${esc(a.kurTarihi)})` : ''}` : ''}</p></div>
      <div class="rapor-tarih">${new Date().toLocaleDateString('tr-TR', { dateStyle: 'long' })}</div>
    </div>
    <table class="rapor-tablo">
      <thead><tr><th class="sol">Dönem</th><th class="sol">Oda Tipi</th><th>Satış<br>kişi başı</th><th>Erken<br>Rez. %</th>
        <th>İndirimli<br>kişi başı</th><th>Komisyon</th><th>NET<br>kişi başı</th><th>Satış<br>oda (${s.kisi} kişi)</th><th>NET<br>oda (${s.kisi} kişi)</th>
        ${d ? `<th>NET ${sembol}<br>kişi başı</th><th>NET ${sembol}<br>oda (${s.kisi} kişi)</th>` : ''}</tr></thead>
      <tbody>${dolu.map(({ f, r }) => `<tr><td class="sol">${esc(f.donem)}</td><td class="sol">${esc(f.odaTipi)}</td>
        <td>${tl(r.satis)}</td><td>%${nf1.format(r.eb)}</td><td>${tl(r.ebSonrasi)}</td><td>${tl(r.komisyon)}</td>
        <td class="net">${tl(r.net)}</td><td>${tl(r.odaSatis)}</td><td class="net">${tl(r.odaNet)}</td>
        ${d ? `<td class="net">${dvz(r.dNet)}</td><td class="net">${dvz(r.dOdaNet)}</td>` : ''}</tr>`).join('')
        || `<tr><td colspan="${d ? 11 : 9}">Fiyat girilmemiş.</td></tr>`}</tbody>
    </table>
    <p class="rapor-not">NET = Satış fiyatı × (1 − Erken Rezervasyon %) × (1 − Komisyon %). Önce Erken Rezervasyon indirimi, sonra acente komisyonu düşülmüştür.
      Fiyatlar kişi başı gecelik${d ? `; döviz karşılıkları TL ÷ kur ile hesaplanmıştır` : ''}.</p>`;
}

const $icerik = document.getElementById('icerik');
const $rapor = document.getElementById('rapor');
function ciz() {
  sonuc = netTablo(veri);
  $icerik.innerHTML = sayfa();
  yaz();
}
function yaz() {
  sonuc = netTablo(veri);
  document.getElementById('baslik').textContent = veri.ad || 'Net Oda Fiyatları';
  document.title = `${veri.ad || 'Net Oda Fiyatları'} – Net Oda Fiyatı`;
  document.getElementById('kpi-serit').innerHTML = FN.kpi(sonuc);
  document.querySelectorAll('[data-cikti]').forEach((el) => {
    el.textContent = (BICIMLER[el.dataset.bicim] || tl)(yolOku(sonuc, el.dataset.cikti));
  });
  document.querySelectorAll('[data-fn]').forEach((el) => { el.innerHTML = FN[el.dataset.fn](sonuc); });
  $rapor.innerHTML = raporHtml(sonuc);
}

// ---------------- Kaydetme ----------------
const $durum = document.getElementById('kayit-durumu');
let zamanlayici = null;
function durum(metin, hata = false) {
  $durum.textContent = metin;
  $durum.classList.toggle('hata', hata);
}
function kaydetPlanla(degisti = true) {
  if (degisti) veri.guncelleme = new Date().toISOString();
  durum('Kaydediliyor…');
  clearTimeout(zamanlayici);
  zamanlayici = setTimeout(async () => {
    try {
      const y = await fetch('/api/veri', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(depo),
      });
      if (!y.ok) throw new Error();
      durum(`Kaydedildi ✓ ${new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`);
    } catch {
      durum('Kaydedilemedi! Sunucu çalışıyor mu?', true);
    }
  }, 500);
}

function listeAc(id) {
  veri = depo.listeler.find((l) => l.id === id) || depo.listeler[0];
  depo.aktifId = veri.id;
  if (!veri.fiyatlar.length) veri.fiyatlar.push(bosSatir());
  hedefNet = '';
  ciz();
  window.scrollTo({ top: 0 });
}
const bosSatir = (donem = '') => ({ id: yeniId(), donem, odaTipi: '', fiyat: '', erkenRez: '' });

// ---------------- Olaylar ----------------
document.addEventListener('input', (e) => {
  if (e.target.id === 'hedef-net') {
    hedefNet = e.target.value;
    yaz();
    return;
  }
  if (e.target.id === 'liste-adi') {
    veri.ad = e.target.value;
    yaz();
    kaydetPlanla();
    return;
  }
  const el = e.target.closest('[data-yol]');
  if (!el || el.tagName === 'SELECT') return;
  const deger = el.dataset.tip === 'sayi' ? (el.value === '' ? '' : Number(el.value)) : el.value;
  yolYaz(veri, el.dataset.yol, deger);
  if (el.dataset.yeniden) ciz();
  else yaz();
  kaydetPlanla();
});
document.addEventListener('change', (e) => {
  const el = e.target.closest('select[data-yol]');
  if (!el) return;
  yolYaz(veri, el.dataset.yol, el.value);
  ciz();
  kaydetPlanla();
});

document.addEventListener('click', async (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.ekle) {
    veri.fiyatlar.push(bosSatir(veri.fiyatlar[veri.fiyatlar.length - 1]?.donem || ''));
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
  } else if (b.dataset.ac) {
    listeAc(b.dataset.ac);
    kaydetPlanla(false);
  } else if (b.dataset.liste === 'yeni') {
    const ad = prompt('Yeni fiyat listesinin adı:', `Fiyat Listesi ${depo.listeler.length + 1}`);
    if (ad === null) return;
    const l = bosListe(ad.trim() || `Fiyat Listesi ${depo.listeler.length + 1}`);
    l.ayarlar = { ...structuredClone(veri.ayarlar) }; // oranlar ve kurlar önceki listeden
    depo.listeler.push(l);
    listeAc(l.id);
    kaydetPlanla();
  } else if (b.dataset.liste === 'kopya') {
    const l = structuredClone(veri);
    l.id = yeniId();
    l.ad = `${veri.ad} (kopya)`;
    l.olusturma = new Date().toISOString();
    l.fiyatlar = l.fiyatlar.map((f) => ({ ...f, id: yeniId() }));
    depo.listeler.push(l);
    listeAc(l.id);
    kaydetPlanla();
  } else if (b.dataset.liste === 'sil') {
    if (!confirm(`"${veri.ad}" listesi kalıcı olarak silinsin mi?`)) return;
    depo.listeler = depo.listeler.filter((l) => l.id !== veri.id);
    if (!depo.listeler.length) depo.listeler.push(bosListe('Fiyat Listesi 1'));
    listeAc(depo.listeler[0].id);
    kaydetPlanla(false);
  } else if (b.dataset.kur === 'tcmb') {
    const $k = document.getElementById('kur-durum');
    $k.textContent = 'Getiriliyor…';
    try {
      const y = await fetch('/api/kur');
      if (!y.ok) throw new Error((await y.json()).hata);
      const { kurlar, tarih } = tcmbKurlariniOku(await y.text());
      if (!Object.keys(kurlar).length) throw new Error('Kur bulunamadı');
      veri.ayarlar.kurlar = { ...veri.ayarlar.kurlar, ...kurlar };
      veri.ayarlar.kurTarihi = `${tarih} TCMB döviz alış`;
      ciz();
      kaydetPlanla();
    } catch (err) {
      $k.textContent = `Alınamadı (internet bağlantısı?). Kuru elle yazabilirsiniz.`;
      console.warn(err);
    }
  } else if (b.dataset.islem === 'pdf') {
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
  const d = dovizVar();
  const satir = (...h) => h.map(hucre).join(';');
  const satirlar = [
    satir(veri.ad),
    satir('Acente komisyonu %', Number(a.komisyon) || 0),
    satir('Erken Rezervasyon %', Number(a.erkenRez) || 0),
    ...(d ? [satir(`1 ${a.doviz} (TL)`, sonuc.kur, a.kurTarihi || '')] : []),
    '',
    satir('Dönem', 'Oda Tipi', 'Satış TL (kişi)', 'Erken Rez. %', 'Erken Rez. indirimi TL', 'İndirimli TL (kişi)', 'Komisyon TL',
      'NET TL (kişi)', `Satış TL (oda, ${k} kişi)`, `NET TL (oda, ${k} kişi)`,
      ...(d ? [`NET ${a.doviz} (kişi)`, `NET ${a.doviz} (oda, ${k} kişi)`] : []), 'Toplam kesinti %'),
    ...veri.fiyatlar.map((f, i) => {
      const r = sonuc.satirlar[i];
      return satir(f.donem, f.odaTipi, r.satis, r.eb, r.ebIndirim, r.ebSonrasi, r.komisyon, r.net, r.odaSatis, r.odaNet,
        ...(d ? [r.dNet, r.dOdaNet] : []), r.toplamKesinti * 100);
    }),
  ];
  const ad = (veri.ad || 'net-oda-fiyatlari').toLocaleLowerCase('tr-TR').replace(/[^a-z0-9çğıöşü]+/gi, '-').replace(/^-|-$/g, '');
  const url = URL.createObjectURL(new Blob(['﻿' + satirlar.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
  const link = Object.assign(document.createElement('a'), { href: url, download: `${ad || 'net-oda-fiyatlari'}.csv` });
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------------- Başlangıç ----------------
(async function baslat() {
  try {
    const y = await fetch('/api/veri');
    depo = depoHazirla(await y.json());
    durum('Veriler yüklendi');
  } catch {
    durum('Sunucuya bağlanılamadı', true);
  }
  listeAc(depo.aktifId);
})();
