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

export const AYLAR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

// Aylık kişi girişi yapılmış mı? (en az bir ay dolu)
export function aylikVarMi(dizi) {
  return !!dizi && AYLAR.some((_, i) => dizi[i] !== '' && dizi[i] !== null && dizi[i] !== undefined);
}

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

function tarihOku(metin) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(metin || '');
  if (!m) return null;
  const t = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return Number.isNaN(t.getTime()) ? null : t;
}
const GUN_MS = 86400000;
const ayinGunSayisi = (yil, ay) => new Date(Date.UTC(yil, ay + 1, 0)).getUTCDate();

/** 2026 tarihinin gün/ayını verilen yıla taşır (2027 sezonu boşsa 2026 ile aynı tarihler). */
export function yilaTasi(metin, yil) {
  return tarihOku(metin) ? `${yil}${metin.slice(4)}` : '';
}

/**
 * Otelin bir yıldaki çalışma dönemi.
 *  gun: açık gün sayısı (oda kapasitesi için)
 *  oranlar: her ay için maaş oranı (tam ay = 1, yarım ay = çalışılan gün / 30, kapalı = 0)
 *  aylar: açık ayların indeksleri
 */
export function donem(otel = {}, yil) {
  if (otel.calismaSekli === 'sezon') {
    const bas = tarihOku(otel[`sezon${yil}Bas`] || (yil === 2027 ? yilaTasi(otel.sezon2026Bas, 2027) : ''));
    const bit = tarihOku(otel[`sezon${yil}Bit`] || (yil === 2027 ? yilaTasi(otel.sezon2026Bit, 2027) : ''));
    if (bas && bit && bit >= bas) {
      const oranlar = AYLAR.map((_, ay) => {
        const y = bas.getUTCFullYear();
        const ayBas = Date.UTC(y, ay, 1);
        const ayBit = Date.UTC(y, ay, ayinGunSayisi(y, ay));
        const g = Math.max(0, (Math.min(ayBit, bit.getTime()) - Math.max(ayBas, bas.getTime())) / GUN_MS + 1);
        if (g <= 0) return 0;
        return g >= ayinGunSayisi(y, ay) ? 1 : Math.min(1, g / 30);
      });
      return {
        sezon: true,
        bas: bas.toISOString().slice(0, 10),
        bit: bit.toISOString().slice(0, 10),
        gun: Math.round((bit - bas) / GUN_MS) + 1,
        oranlar,
        aylar: AYLAR.map((_, i) => i).filter((i) => oranlar[i] > 0),
      };
    }
  }
  const gun = yil === 2027 ? ya(otel.acikGun2027, ya(otel.acikGun2026, 365)) : ya(otel.acikGun2026, 365);
  return { sezon: false, gun, oranlar: AYLAR.map(() => 1), aylar: AYLAR.map((_, i) => i) };
}

/**
 * Oda satışları iki şekilde girilebilir:
 *  - 'toplam': otelin toplam oda sayısı, dönemde satılan toplam oda-gece ve toplam oda geliri
 *  - 'tip': oda tiplerine göre adet, ortalama fiyat ve doluluk
 * Toplam giriş tek bir "Tüm odalar" satırına çevrilir; hesabın geri kalanı aynıdır.
 */
export function odaSatirlari(veri, gun26, gun27) {
  if (veri.odaGiris !== 'toplam') return veri.odalar || [];
  const t = veri.odaToplam || {};
  const adet = sayi(t.adet);
  const adet27 = ya(t.adet2027, t.adet);
  const satilan26 = sayi(t.satilan2026);
  const kap26 = adet * gun26;
  const kap27 = adet27 * gun27;
  return [{
    ad: 'Tüm odalar',
    adet,
    adet2027: t.adet2027,
    fiyat2026: bol(sayi(t.gelir2026), satilan26),
    doluluk2026: bol(satilan26, kap26) * 100,
    fiyatZam: t.fiyatZam,
    // 2027 satılan oda hedefi girilmemişse 2026 doluluğu korunur.
    doluluk2027: bos(t.satilan2027) ? '' : bol(sayi(t.satilan2027), kap27) * 100,
  }];
}

/**
 * Tüm bütçeyi hesaplar.
 * @param {object} veri  Kullanıcının girdiği veri.
 * @param {object} [senaryo]  { fiyatCarpan, dolulukPuan, dolulukCarpan } - 2027 oda varsayımlarını değiştirir.
 */
export function hesaplaTemel(veri, senaryo = {}) {
  const v = veri.varsayimlar || {};
  const otel = veri.otel || {};
  const enflasyon = sayi(v.enflasyon);
  const donem26 = donem(otel, 2026);
  const donem27 = donem(otel, 2027);
  const gun26 = donem26.gun;
  const gun27 = donem27.gun;
  const fiyatCarpan = ya(senaryo.fiyatCarpan, 1);
  const dolulukPuan = sayi(senaryo.dolulukPuan);
  const dolulukCarpan = ya(senaryo.dolulukCarpan, 1);

  // ---- Oda gelirleri ----
  const odalar = odaSatirlari(veri, gun26, gun27).map((o) => {
    const adet = sayi(o.adet);
    const adet27 = ya(o.adet2027, o.adet);
    const kapasite26 = adet * gun26;
    const kapasite27 = adet27 * gun27;
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
      ad: o.ad, adet, adet27, zam, fiyat26, fiyat27, doluluk26, doluluk27,
      kapasite26, kapasite27, satilan26, satilan27,
      gelir26: satilan26 * fiyat26,
      gelir27: satilan27 * fiyat27,
    };
  });

  const topla = (dizi, alan) => dizi.reduce((t, x) => t + (x[alan] || 0), 0);
  const oda = {
    adet: topla(odalar, 'adet'),
    adet27: topla(odalar, 'adet27'),
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
  // Kişi sayısı her ay için ayrı girilir (aylik2026 / aylik2027, 12 elemanlı).
  // Maaş, ayın çalışılan kısmı kadar ödenir (sezon başlangıç/bitiş ayı kısmi).
  // Eski tip satırlar (kisi2026 + yılda çalışılan ay) da desteklenir.
  // "Kişi" = açık aylardaki ortalama kişi sayısı.
  const sgk = yuzde(v.sgkIsveren);
  const O26 = donem26.oranlar;
  const O27 = donem27.oranlar;
  const acikOrt = (vektor, O) => bol(vektor.reduce((t, x, i) => t + x * O[i], 0), O.reduce((t, x) => t + x, 0));
  const personel = (veri.personel || []).map((p) => {
    const maas26 = sayi(p.maas2026);
    const temmuzZam = ya(p.temmuzZam, v.temmuzZam);
    // Ocak 2027 maaşı doğrudan girilmişse o, yoksa güncel maaş + Ocak zammı.
    const maasOcak27 = bos(p.maas2027)
      ? maas26 * (1 + ya(p.ocakZam, v.ocakZam) / 100)
      : sayi(p.maas2027);
    const ocakZam = maas26 ? (maasOcak27 / maas26 - 1) * 100 : 0;
    const maasTemmuz27 = maasOcak27 * (1 + temmuzZam / 100);
    const maas27Ay = (i) => (i < 6 ? maasOcak27 : maasTemmuz27);
    const yanHak26 = sayi(p.yanHak);
    const yanHak27 = yanHak26 * (1 + enflasyon / 100);
    const ay = sinirla(ya(p.ay, 12), 0, 12);
    const ay27 = sinirla(ya(p.ay2027, ay), 0, 12);
    const olcek = p.dolulugaBagli ? hacimOrani : 1;

    const aylikMi26 = aylikVarMi(p.aylik2026);
    const aylikMi27 = aylikVarMi(p.aylik2027);
    // Eski tip: yıl boyu açık otelde yılın bir kısmı çalışan satır.
    const eskiTip = !aylikMi26 && !aylikMi27 && !donem26.sezon && (ay < 12 || ay27 < 12);

    let aylik26;
    let aylik27;
    let onerilenAylik27;
    let kisiAy26;
    let kisiAy27;
    let brut26;
    let brut27;
    let kisi26;
    let kisi27;
    let onerilenKisi27;

    if (eskiTip) {
      kisi26 = sayi(p.kisi2026);
      onerilenKisi27 = Math.round(kisi26 * olcek);
      kisi27 = ya(p.kisi2027, onerilenKisi27);
      aylik26 = AYLAR.map(() => (kisi26 * ay) / 12);
      aylik27 = AYLAR.map(() => (kisi27 * ay27) / 12);
      onerilenAylik27 = AYLAR.map(() => (onerilenKisi27 * ay27) / 12);
      const ilkYari = Math.floor(ay27 / 2);
      kisiAy26 = kisi26 * ay;
      kisiAy27 = kisi27 * ay27;
      brut26 = kisiAy26 * maas26;
      brut27 = kisi27 * (maasOcak27 * ilkYari + maasTemmuz27 * (ay27 - ilkYari));
    } else {
      aylik26 = aylikMi26
        ? AYLAR.map((_, i) => (O26[i] > 0 ? sayi(p.aylik2026[i]) : 0))
        : AYLAR.map((_, i) => (O26[i] > 0 ? sayi(p.kisi2026) : 0));
      // 2027 önerisi: 2026'daki aylık kişi sayısı (doluluğa bağlıysa satılan oda artışı oranında).
      const eskiKisi27 = !aylikMi26 && !bos(p.kisi2027) ? sayi(p.kisi2027) : null;
      onerilenAylik27 = AYLAR.map((_, i) => {
        if (O27[i] === 0) return 0;
        if (eskiKisi27 !== null) return eskiKisi27;
        const temel = O26[i] > 0 ? aylik26[i] : 0;
        return Math.round(temel * olcek);
      });
      aylik27 = AYLAR.map((_, i) =>
        O27[i] > 0 ? ya(aylikMi27 ? p.aylik2027[i] : '', onerilenAylik27[i]) : 0);
      kisiAy26 = aylik26.reduce((t, x, i) => t + x * O26[i], 0);
      kisiAy27 = aylik27.reduce((t, x, i) => t + x * O27[i], 0);
      brut26 = kisiAy26 * maas26;
      brut27 = aylik27.reduce((t, x, i) => t + x * O27[i] * maas27Ay(i), 0);
      kisi26 = acikOrt(aylik26, O26);
      kisi27 = acikOrt(aylik27, O27);
      onerilenKisi27 = acikOrt(onerilenAylik27, O27);
    }

    const maliyet26 = brut26 * (1 + sgk) + kisiAy26 * yanHak26;
    const maliyet27 = brut27 * (1 + sgk) + kisiAy27 * yanHak27;
    return {
      aylikMi26, aylikMi27, eskiTip, aylik26, aylik27, onerilenAylik27,
      kisi26, kisi27, onerilenKisi27, kisiAy26, kisiAy27, ay, ay27,
      maas26, maasOcak27, maasTemmuz27, ocakZam, temmuzZam, maliyet26, maliyet27,
      kisiBasi27: bol(maliyet27, kisiAy27),
    };
  });
  const aylikTopla = (dizi, alan) => AYLAR.map((_, i) => dizi.reduce((t, x) => t + x[alan][i], 0));
  const personelOzet = {
    kisi26: topla(personel, 'kisi26'),
    kisi27: topla(personel, 'kisi27'),
    maliyet26: topla(personel, 'maliyet26'),
    maliyet27: topla(personel, 'maliyet27'),
    aylik26: aylikTopla(personel, 'aylik26'),
    aylik27: aylikTopla(personel, 'aylik27'),
  };
  personelOzet.zirve26 = Math.max(0, ...personelOzet.aylik26);
  personelOzet.zirve27 = Math.max(0, ...personelOzet.aylik27);
  const departmanlar = {};
  (veri.personel || []).forEach((p, i) => {
    const ad = (p.departman || 'Diğer').trim() || 'Diğer';
    const d = (departmanlar[ad] ||= {
      ad, kisi26: 0, kisi27: 0, maliyet26: 0, maliyet27: 0,
      aylik26: AYLAR.map(() => 0), aylik27: AYLAR.map(() => 0),
    });
    for (const k of ['kisi26', 'kisi27', 'maliyet26', 'maliyet27']) d[k] += personel[i][k];
    AYLAR.forEach((_, m) => {
      d.aylik26[m] += personel[i].aylik26[m];
      d.aylik27[m] += personel[i].aylik27[m];
    });
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
      // 2027 tutarı doğrudan girilmişse (ör. imzalı kira sözleşmesi) o kullanılır.
      tutar27 = bos(g.tutar2027) ? tutar26 * hacim * (1 + artis / 100) : sayi(g.tutar2027);
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
    donem26, donem27,
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
    personelOdaOrani27: bol(personelOzet.kisi27, oda.adet27),
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
    otel: {
      ad: 'Otelim', paraBirimi: '₺', calismaSekli: 'yil', acikGun2026: 365, acikGun2027: '',
      sezon2026Bas: '', sezon2026Bit: '', sezon2027Bas: '', sezon2027Bit: '',
    },
    // 2027 zamları kullanıcı kararıdır; boş bırakılanlar %0 kabul edilir.
    varsayimlar: {
      enflasyon: '',
      odaFiyatZam: '',
      ocakZam: '',
      temmuzZam: '',
      sgkIsveren: 22.75,
      kurumlarVergisi: 25,
      hedefKarMarji: 20,
      kategoriZam: {},
    },
    odaGiris: 'toplam',
    odaToplam: { adet: '', satilan2026: '', gelir2026: '', adet2027: '', fiyatZam: '', satilan2027: '' },
    odalar: [],
    digerGelirler: [],
    personel: [],
    giderler: [],
  };
}
