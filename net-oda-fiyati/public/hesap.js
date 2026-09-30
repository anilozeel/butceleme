// Net oda fiyatı hesabı: satış fiyatı (komisyon dahil, kişi başı)
//   → önce Erken Rezervasyon indirimi düşülür
//   → sonra acente komisyonu düşülür
//   = otele kalan net fiyat.

const bos = (v) => v === null || v === undefined || v === '';
const sayi = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const ya = (v, varsayilan) => (bos(v) ? sayi(varsayilan) : sayi(v));

export const DOVIZLER = { EUR: '€', USD: '$', GBP: '£' };

// Otelin oda tipleri: yeni listede ve "Dönem ekle"de her biri için satır açılır.
export const ODA_TIPLERI = [
  'Ekonomik Oda',
  'Bahçe Manzaralı Oda',
  'Standart Deniz veya Havuz Manzaralı Oda',
];

/** Bir dönem için her oda tipine birer boş fiyat satırı. */
export function donemSatirlari(odaTipleri = ODA_TIPLERI, donem = '') {
  return odaTipleri.map((odaTipi) => ({
    id: Math.random().toString(36).slice(2, 10), donem, odaTipi, fiyat: '', erkenRez: '',
  }));
}

/** Yeni, boş bir fiyat listesi. Fiyatlar TL girilir; döviz isteğe bağlıdır. */
export function bosListe(ad = 'Yeni Fiyat Listesi') {
  const simdi = new Date().toISOString();
  return {
    id: Math.random().toString(36).slice(2, 10),
    ad,
    olusturma: simdi,
    guncelleme: simdi,
    ayarlar: {
      komisyon: 20, erkenRez: '', kisi: 2, doviz: '', kurlar: { EUR: '', USD: '', GBP: '' }, kurTarihi: '',
      odaTipleri: [...ODA_TIPLERI],
    },
    fiyatlar: donemSatirlari(),
  };
}

/** Kayıtlı tüm listeler. Eski tek-liste kaydını (ayarlar + fiyatlar) listeye çevirir. */
export function depoHazirla(gelen = {}) {
  let listeler = Array.isArray(gelen.listeler) ? gelen.listeler : [];
  if (!listeler.length && (gelen.ayarlar || gelen.fiyatlar)) {
    const eski = bosListe(gelen.ayarlar?.baslik || 'Fiyat Listesi 1');
    eski.ayarlar = { ...eski.ayarlar, ...(gelen.ayarlar || {}) };
    delete eski.ayarlar.baslik;
    delete eski.ayarlar.paraBirimi;
    eski.fiyatlar = gelen.fiyatlar || [];
    listeler = [eski];
  }
  listeler = listeler.map((l) => {
    const temel = bosListe(l.ad);
    return {
      ...temel, ...l,
      ayarlar: { ...temel.ayarlar, ...(l.ayarlar || {}), kurlar: { ...temel.ayarlar.kurlar, ...(l.ayarlar?.kurlar || {}) } },
      fiyatlar: Array.isArray(l.fiyatlar) ? l.fiyatlar : [],
    };
  }).map((l) => {
    const tipler = Array.isArray(l.ayarlar.odaTipleri) && l.ayarlar.odaTipleri.length ? l.ayarlar.odaTipleri : [...ODA_TIPLERI];
    l.ayarlar.odaTipleri = tipler;
    // Hiç fiyat girilmemiş (boş) liste: oda tipleriyle doldur.
    const bosMu = l.fiyatlar.every((f) => !f.fiyat && !f.odaTipi && !f.donem);
    if (bosMu) l.fiyatlar = donemSatirlari(tipler, l.fiyatlar[0]?.donem || '');
    return l;
  });
  if (!listeler.length) listeler = [bosListe('Fiyat Listesi 1')];
  const aktifId = listeler.some((l) => l.id === gelen.aktifId) ? gelen.aktifId : listeler[0].id;
  return { listeler, aktifId };
}

/** Seçili dövizin kuru (1 döviz = kaç TL). Seçilmemiş veya kur yoksa null. */
export function aktifKur(ayarlar = {}) {
  if (!ayarlar.doviz) return null;
  const kur = sayi(ayarlar.kurlar?.[ayarlar.doviz]);
  return kur > 0 ? kur : null;
}

/** TCMB günlük kur XML'inden döviz alış kurlarını çıkarır. */
export function tcmbKurlariniOku(xml) {
  const sonuc = {};
  for (const kod of Object.keys(DOVIZLER)) {
    const blok = new RegExp(`<Currency[^>]*Kod="${kod}"[^>]*>([\\s\\S]*?)</Currency>`).exec(xml);
    const alis = blok && /<ForexBuying>([\d.]+)<\/ForexBuying>/.exec(blok[1]);
    if (alis) sonuc[kod] = Number(alis[1]);
  }
  const tarih = /Tarih="([\d.]+)"/.exec(xml);
  return { kurlar: sonuc, tarih: tarih ? tarih[1] : '' };
}

/** Tek bir kişi başı fiyattan net hesabı. */
export function netHesapla(fiyat, erkenRezYuzde, komisyonYuzde) {
  const satis = sayi(fiyat);
  const ebIndirim = satis * (sayi(erkenRezYuzde) / 100);
  const ebSonrasi = satis - ebIndirim;
  const komisyon = ebSonrasi * (sayi(komisyonYuzde) / 100);
  const net = ebSonrasi - komisyon;
  return {
    satis, ebIndirim, ebSonrasi, komisyon, net,
    // %20 indirim + %20 komisyon = %36 toplam kesinti (%40 değil)
    toplamKesinti: satis ? 1 - net / satis : 1 - (1 - sayi(erkenRezYuzde) / 100) * (1 - sayi(komisyonYuzde) / 100),
  };
}

/** Hedef net fiyata ulaşmak için gereken satış fiyatı (ters hesap). */
export function gerekenSatis(hedefNet, erkenRezYuzde, komisyonYuzde) {
  const kalan = (1 - sayi(erkenRezYuzde) / 100) * (1 - sayi(komisyonYuzde) / 100);
  return kalan > 0 ? sayi(hedefNet) / kalan : null;
}

export function netTablo(veri) {
  const a = veri.ayarlar || {};
  const kisi = ya(a.kisi, 2) || 2;
  const kur = aktifKur(a);
  const cevir = (tl) => (kur ? tl / kur : null);
  const satirlar = (veri.fiyatlar || []).map((f) => {
    const eb = ya(f.erkenRez, a.erkenRez);
    const r = netHesapla(f.fiyat, eb, a.komisyon);
    const satir = {
      ...r, eb,
      odaSatis: r.satis * kisi,
      odaEbIndirim: r.ebIndirim * kisi,
      // Acentenin erken rezervasyon indirimiyle satacağı (ilan edeceği) oda fiyatı
      odaIndirimli: r.ebSonrasi * kisi,
      odaKomisyon: r.komisyon * kisi,
      odaNet: r.net * kisi,
    };
    // Döviz karşılıkları (TL ÷ kur)
    satir.dSatis = cevir(satir.satis);
    satir.dNet = cevir(satir.net);
    satir.dOdaSatis = cevir(satir.odaSatis);
    satir.dOdaIndirimli = cevir(satir.odaIndirimli);
    satir.dOdaNet = cevir(satir.odaNet);
    return satir;
  });
  const dolu = satirlar.filter((s) => s.satis > 0);
  const ort = (alan) => (dolu.length ? dolu.reduce((t, s) => t + s[alan], 0) / dolu.length : 0);
  return {
    kisi,
    kur,
    satirlar,
    ortalama: {
      satis: ort('satis'), net: ort('net'), odaSatis: ort('odaSatis'), odaNet: ort('odaNet'),
      odaIndirimli: ort('odaIndirimli'), dOdaIndirimli: cevir(ort('odaIndirimli')),
      dSatis: cevir(ort('satis')), dNet: cevir(ort('net')), dOdaSatis: cevir(ort('odaSatis')), dOdaNet: cevir(ort('odaNet')),
      toplamKesinti: ort('satis') ? 1 - ort('net') / ort('satis') : 0,
    },
  };
}
