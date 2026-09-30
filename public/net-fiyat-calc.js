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

export function bosNetVeri() {
  return {
    ayarlar: { baslik: 'Net Oda Fiyatları', paraBirimi: '€', komisyon: 20, erkenRez: '', kisi: 2 },
    fiyatlar: [],
  };
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
  const satirlar = (veri.fiyatlar || []).map((f) => {
    const eb = ya(f.erkenRez, a.erkenRez);
    const r = netHesapla(f.fiyat, eb, a.komisyon);
    return {
      ...r, eb,
      odaSatis: r.satis * kisi,
      odaEbIndirim: r.ebIndirim * kisi,
      odaKomisyon: r.komisyon * kisi,
      odaNet: r.net * kisi,
    };
  });
  const dolu = satirlar.filter((s) => s.satis > 0);
  const ort = (alan) => (dolu.length ? dolu.reduce((t, s) => t + s[alan], 0) / dolu.length : 0);
  return {
    kisi,
    satirlar,
    ortalama: {
      satis: ort('satis'), net: ort('net'), odaSatis: ort('odaSatis'), odaNet: ort('odaNet'),
      toplamKesinti: ort('satis') ? 1 - ort('net') / ort('satis') : 0,
    },
  };
}
