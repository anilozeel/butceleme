// Otel bütçe hesap motoru.
// Tarayıcıda ve Node'da (testler) aynı şekilde çalışır; DOM'a bağımlılığı yoktur.

export const KATEGORILER = [
  'Vergi ve Harçlar',
  'Kira',
  'Elektrik',
  'Su',
  'Doğalgaz / Yakıt',
  'Gıda & İçecek Maliyeti',
  'Komisyonlar',
  'Satış & Pazarlama',
  'Bakım & Onarım',
  'Sigorta',
  'Genel Yönetim Giderleri',
  'Diğer Giderler',
];

export const GIDER_TIPLERI = {
  sabit: 'Sabit (yıllık tutar)',
  degisken: 'Değişken (dolulukla artar)',
  gelirYuzdesi: 'Gelirin yüzdesi',
};

const bos = (v) => v === null || v === undefined || v === '';
const sayi = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
// Boşsa varsayılanı, değilse sayıyı döndürür.
const ya = (v, varsayilan) => (bos(v) ? sayi(varsayilan) : sayi(v));
const yuzde = (p) => sayi(p) / 100;
const sinirla = (x, alt = 0, ust = 1) => Math.min(ust, Math.max(alt, x));
const bol = (a, b) => (b ? a / b : 0);

/**
 * Tüm bütçeyi hesaplar.
 * @param {object} veri  Kullanıcının girdiği veri.
 * @param {object} [senaryo]  { fiyatCarpan, dolulukPuan, dolulukCarpan } - 2027 oda varsayımlarını değiştirir.
 */
export function hesaplaTemel(veri, senaryo = {}) {
  const v = veri.varsayimlar || {};
  const otel = veri.otel || {};
  const enflasyon = sayi(v.enflasyon);
  const gun26 = ya(otel.acikGun2026, 365);
  const gun27 = ya(otel.acikGun2027, gun26);
  const fiyatCarpan = ya(senaryo.fiyatCarpan, 1);
  const dolulukPuan = sayi(senaryo.dolulukPuan);
  const dolulukCarpan = ya(senaryo.dolulukCarpan, 1);

  // ---- Oda gelirleri ----
  const odalar = (veri.odalar || []).map((o) => {
    const adet = sayi(o.adet);
    const kapasite26 = adet * gun26;
    const kapasite27 = adet * gun27;
    const doluluk26 = sinirla(yuzde(o.doluluk2026));
    const doluluk27 = sinirla(
      yuzde(ya(o.doluluk2027, o.doluluk2026)) * dolulukCarpan + dolulukPuan / 100
    );
    const satilan26 = kapasite26 * doluluk26;
    const satilan27 = kapasite27 * doluluk27;
    const zam = ya(o.fiyatZam, v.odaFiyatZam);
    const fiyat26 = sayi(o.fiyat2026);
    const fiyat27 = fiyat26 * (1 + zam / 100) * fiyatCarpan;
    return {
      adet, zam, fiyat26, fiyat27, doluluk26, doluluk27,
      kapasite26, kapasite27, satilan26, satilan27,
      gelir26: satilan26 * fiyat26,
      gelir27: satilan27 * fiyat27,
    };
  });

  const topla = (dizi, alan) => dizi.reduce((t, x) => t + (x[alan] || 0), 0);
  const oda = {
    adet: topla(odalar, 'adet'),
    kapasite26: topla(odalar, 'kapasite26'),
    kapasite27: topla(odalar, 'kapasite27'),
    satilan26: topla(odalar, 'satilan26'),
    satilan27: topla(odalar, 'satilan27'),
    gelir26: topla(odalar, 'gelir26'),
    gelir27: topla(odalar, 'gelir27'),
  };
  oda.doluluk26 = bol(oda.satilan26, oda.kapasite26);
  oda.doluluk27 = bol(oda.satilan27, oda.kapasite27);
  oda.adr26 = bol(oda.gelir26, oda.satilan26);
  oda.adr27 = bol(oda.gelir27, oda.satilan27);
  oda.revpar26 = bol(oda.gelir26, oda.kapasite26);
  oda.revpar27 = bol(oda.gelir27, oda.kapasite27);

  // Satılan oda gecelemesindeki değişim: değişken kalemler bununla ölçeklenir.
  const hacimOrani = oda.satilan26 > 0 ? oda.satilan27 / oda.satilan26 : 1;

  // ---- Diğer gelirler (Yiyecek-İçecek, SPA, vb.) ----
  const digerGelirler = (veri.digerGelirler || []).map((g) => {
    const artis = ya(g.artis, enflasyon);
    const tutar26 = sayi(g.tutar2026);
    const hacim = g.tip === 'degisken' ? hacimOrani : 1;
    return { artis, tutar26, tutar27: tutar26 * hacim * (1 + artis / 100) };
  });
  const digerGelir26 = topla(digerGelirler, 'tutar26');
  const digerGelir27 = topla(digerGelirler, 'tutar27');
  const gelir26 = oda.gelir26 + digerGelir26;
  const gelir27 = oda.gelir27 + digerGelir27;

  // ---- Personel ----
  const sgk = yuzde(v.sgkIsveren);
  const personel = (veri.personel || []).map((p) => {
    const kisi26 = sayi(p.kisi2026);
    const onerilenKisi27 = p.dolulugaBagli ? Math.round(kisi26 * hacimOrani) : kisi26;
    const kisi27 = ya(p.kisi2027, onerilenKisi27);
    const ay = sinirla(ya(p.ay, 12), 0, 12);
    const maas26 = sayi(p.maas2026);
    const ocakZam = ya(p.ocakZam, v.ocakZam);
    const temmuzZam = ya(p.temmuzZam, v.temmuzZam);
    // Çalışılan ayların yarısı Ocak zammıyla, kalanı Temmuz zammıyla ödenir.
    const ayIlkYari = Math.floor(ay / 2);
    const ayIkinciYari = ay - ayIlkYari;
    const maasOcak27 = maas26 * (1 + ocakZam / 100);
    const maasTemmuz27 = maasOcak27 * (1 + temmuzZam / 100);
    const yanHak26 = sayi(p.yanHak);
    const yanHak27 = yanHak26 * (1 + enflasyon / 100);

    const brut26 = kisi26 * maas26 * ay;
    const brut27 = kisi27 * (maasOcak27 * ayIlkYari + maasTemmuz27 * ayIkinciYari);
    const maliyet26 = brut26 * (1 + sgk) + kisi26 * yanHak26 * ay;
    const maliyet27 = brut27 * (1 + sgk) + kisi27 * yanHak27 * ay;
    return {
      kisi26, kisi27, onerilenKisi27, ay, maas26, maasOcak27, maasTemmuz27,
      ocakZam, temmuzZam, maliyet26, maliyet27,
      kisiBasi27: bol(maliyet27, kisi27 * ay),
    };
  });
  const personelOzet = {
    kisi26: topla(personel, 'kisi26'),
    kisi27: topla(personel, 'kisi27'),
    maliyet26: topla(personel, 'maliyet26'),
    maliyet27: topla(personel, 'maliyet27'),
  };
  const departmanlar = {};
  (veri.personel || []).forEach((p, i) => {
    const ad = (p.departman || 'Diğer').trim() || 'Diğer';
    const d = (departmanlar[ad] ||= { ad, kisi26: 0, kisi27: 0, maliyet26: 0, maliyet27: 0 });
    for (const k of ['kisi26', 'kisi27', 'maliyet26', 'maliyet27']) d[k] += personel[i][k];
  });

  // ---- Giderler ----
  const kategoriZam = v.kategoriZam || {};
  const giderler = (veri.giderler || []).map((g) => {
    const artis = ya(g.artis, ya(kategoriZam[g.kategori], enflasyon));
    let tutar26;
    let tutar27;
    let oran26 = 0;
    let oran27 = 0;
    if (g.tip === 'gelirYuzdesi') {
      oran26 = yuzde(g.oran);
      oran27 = yuzde(ya(g.oran2027, g.oran));
      const toplamBaz = g.baz === 'toplam';
      tutar26 = (toplamBaz ? gelir26 : oda.gelir26) * oran26;
      tutar27 = (toplamBaz ? gelir27 : oda.gelir27) * oran27;
    } else {
      tutar26 = sayi(g.tutar2026);
      const hacim = g.tip === 'degisken' ? hacimOrani : 1;
      tutar27 = tutar26 * hacim * (1 + artis / 100);
    }
    return { artis, tutar26, tutar27, oran26, oran27 };
  });

  const kategoriler = {};
  (veri.giderler || []).forEach((g, i) => {
    const ad = g.kategori || 'Diğer Giderler';
    const k = (kategoriler[ad] ||= { ad, tutar26: 0, tutar27: 0 });
    k.tutar26 += giderler[i].tutar26;
    k.tutar27 += giderler[i].tutar27;
  });

  const gider26 = topla(giderler, 'tutar26');
  const gider27 = topla(giderler, 'tutar27');
  const toplamGider26 = gider26 + personelOzet.maliyet26;
  const toplamGider27 = gider27 + personelOzet.maliyet27;
  const kar26 = gelir26 - toplamGider26;
  const kar27 = gelir27 - toplamGider27;
  const kvOran = yuzde(v.kurumlarVergisi);
  const kv26 = Math.max(0, kar26) * kvOran;
  const kv27 = Math.max(0, kar27) * kvOran;

  return {
    hacimOrani,
    odalar, oda,
    digerGelirler, digerGelir26, digerGelir27,
    personel, personelOzet, departmanlar: Object.values(departmanlar),
    giderler, kategoriler: Object.values(kategoriler), gider26, gider27,
    gelir26, gelir27, toplamGider26, toplamGider27,
    kar26, kar27, kv26, kv27,
    net26: kar26 - kv26, net27: kar27 - kv27,
    marj26: bol(kar26, gelir26), marj27: bol(kar27, gelir27),
    personelOrani26: bol(personelOzet.maliyet26, gelir26),
    personelOrani27: bol(personelOzet.maliyet27, gelir27),
    personelOdaOrani26: bol(personelOzet.kisi26, oda.adet),
    personelOdaOrani27: bol(personelOzet.kisi27, oda.adet),
    goppar26: bol(kar26, oda.kapasite26),
    goppar27: bol(kar27, oda.kapasite27),
  };
}

/**
 * 2027 doluluğuna göre, belirli bir kâr marjı için gereken toplam oda gelirini bulur.
 * Kâr = OG·(1 − p − q) + D·(1 − q) − F  (p: oda gelirine, q: toplam gelire bağlı gider oranları)
 * Hedef: Kâr = m·(OG + D)  →  OG = (F − D·(1 − q) + m·D) / (1 − p − q − m)
 */
function gerekenOdaGeliri(veri, s, marj) {
  let p = 0;
  let q = 0;
  let F = s.personelOzet.maliyet27;
  (veri.giderler || []).forEach((g, i) => {
    if (g.tip === 'gelirYuzdesi') {
      if (g.baz === 'toplam') q += s.giderler[i].oran27;
      else p += s.giderler[i].oran27;
    } else {
      F += s.giderler[i].tutar27;
    }
  });
  const D = s.digerGelir27;
  const payda = 1 - p - q - marj;
  if (payda <= 0) return null;
  return Math.max(0, (F - D * (1 - q) + marj * D) / payda);
}

function basaBasDoluluk(veri) {
  // Tüm oda tiplerinin 2027 doluluğunu aynı oranda ölçekleyerek kârın sıfırlandığı noktayı arar.
  const kar = (c) => hesaplaTemel(veri, { dolulukCarpan: c }).kar27;
  const temel = hesaplaTemel(veri);
  const maxDol = Math.max(0, ...temel.odalar.map((o) => o.doluluk27));
  if (maxDol === 0) return null;
  let alt = 0;
  let ust = 1 / maxDol;
  if (kar(ust) < 0) return null; // %100 dolulukta bile zarar
  if (kar(alt) >= 0) return 0;
  for (let i = 0; i < 50; i++) {
    const orta = (alt + ust) / 2;
    if (kar(orta) >= 0) ust = orta;
    else alt = orta;
  }
  return hesaplaTemel(veri, { dolulukCarpan: ust }).oda.doluluk27;
}

export const DUYARLILIK_FIYAT = [-10, -5, 0, 5, 10];
export const DUYARLILIK_DOLULUK = [-10, -5, 0, 5, 10];

export function hesapla(veri) {
  const s = hesaplaTemel(veri);
  const marj = yuzde(veri.varsayimlar?.hedefKarMarji);
  const sat = s.oda.satilan27;

  const basaBasOG = gerekenOdaGeliri(veri, s, 0);
  const hedefOG = gerekenOdaGeliri(veri, s, marj);
  const hedef = {
    marj,
    basaBasAdr: basaBasOG === null ? null : bol(basaBasOG, sat),
    hedefAdr: hedefOG === null ? null : bol(hedefOG, sat),
    hedefCarpan: hedefOG === null || !s.oda.gelir27 ? null : hedefOG / s.oda.gelir27,
    basaBasDoluluk: basaBasDoluluk(veri),
  };
  hedef.odaFiyatlari = s.odalar.map((o) => ({
    mevcut27: o.fiyat27,
    hedef27: hedef.hedefCarpan === null ? null : o.fiyat27 * hedef.hedefCarpan,
  }));

  const duyarlilik = DUYARLILIK_DOLULUK.map((dp) =>
    DUYARLILIK_FIYAT.map((fp) => hesaplaTemel(veri, { fiyatCarpan: 1 + fp / 100, dolulukPuan: dp }).kar27)
  );

  return { ...s, hedef, duyarlilik };
}

export function bosVeri() {
  return {
    otel: { ad: 'Otelim', paraBirimi: '₺', acikGun2026: 365, acikGun2027: 365 },
    varsayimlar: {
      enflasyon: 20,
      odaFiyatZam: 20,
      ocakZam: 20,
      temmuzZam: 8,
      sgkIsveren: 22.75,
      kurumlarVergisi: 25,
      hedefKarMarji: 20,
      kategoriZam: {},
    },
    odalar: [],
    digerGelirler: [],
    personel: [],
    giderler: [],
  };
}
