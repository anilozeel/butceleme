import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hesapla, hesaplaTemel, bosVeri, donem } from '../public/calc.js';

const yakin = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b}`);

function veriOlustur(ekle = {}) {
  const v = bosVeri();
  v.otel.acikGun2026 = 100;
  v.otel.acikGun2027 = 100;
  Object.assign(v.varsayimlar, { enflasyon: 10, odaFiyatZam: 20, ocakZam: 10, temmuzZam: 10, sgkIsveren: 20, kurumlarVergisi: 25, hedefKarMarji: 20 });
  return { ...v, odaGiris: 'tip', ...ekle };
}

test('oda geliri: adet × gün × doluluk × fiyat, 2027 zam ve doluluk', () => {
  const s = hesaplaTemel(veriOlustur({
    odalar: [{ adet: 10, fiyat2026: 1000, doluluk2026: 50, fiyatZam: '', doluluk2027: 60 }],
  }));
  yakin(s.oda.satilan26, 500);
  yakin(s.oda.gelir26, 500_000);
  yakin(s.odalar[0].fiyat27, 1200);
  yakin(s.oda.satilan27, 600);
  yakin(s.oda.gelir27, 720_000);
  yakin(s.hacimOrani, 1.2);
});

test('personel: Ocak ve Temmuz zamları yarıyıl olarak uygulanır, SGK eklenir', () => {
  const s = hesaplaTemel(veriOlustur({
    personel: [{ kisi2026: 2, kisi2027: '', maas2026: 1000, ay: 12, yanHak: 0 }],
  }));
  const p = s.personel[0];
  yakin(p.maliyet26, 2 * 1000 * 12 * 1.2);
  // 6 ay 1100, 6 ay 1210
  yakin(p.maliyet27, 2 * (1100 * 6 + 1210 * 6) * 1.2);
});

test('doluluğa bağlı personel satılan oda artışıyla önerilir; elle girilen sayı önceliklidir', () => {
  const odalar = [{ adet: 10, fiyat2026: 1000, doluluk2026: 50, doluluk2027: 75 }];
  const s = hesaplaTemel(veriOlustur({
    odalar,
    personel: [
      { kisi2026: 10, kisi2027: '', maas2026: 1000, dolulugaBagli: true },
      { kisi2026: 10, kisi2027: 12, maas2026: 1000, dolulugaBagli: true },
      { kisi2026: 10, kisi2027: '', maas2026: 1000, dolulugaBagli: false },
    ],
  }));
  assert.equal(s.personel[0].kisi27, 15);
  assert.equal(s.personel[1].kisi27, 12);
  assert.equal(s.personel[2].kisi27, 10);
});

test('gider tipleri: sabit, değişken, gelir yüzdesi ve kategori zammı', () => {
  const v = veriOlustur({
    odalar: [{ adet: 10, fiyat2026: 1000, doluluk2026: 50, doluluk2027: 60 }],
    giderler: [
      { kategori: 'Kira', tip: 'sabit', tutar2026: 1000, artis: '' },
      { kategori: 'Elektrik', tip: 'degisken', tutar2026: 1000, artis: 5 },
      { kategori: 'Vergi ve Harçlar', tip: 'gelirYuzdesi', baz: 'oda', oran: 2 },
    ],
  });
  v.varsayimlar.kategoriZam = { Kira: 30 };
  const s = hesaplaTemel(v);
  yakin(s.giderler[0].tutar27, 1300); // kategori zammı
  yakin(s.giderler[1].tutar27, 1000 * 1.2 * 1.05); // hacim × zam
  yakin(s.giderler[2].tutar26, 10_000);
  yakin(s.giderler[2].tutar27, 14_400);
});

test('başa baş ve hedef oda fiyatı kârı gerçekten 0 ve hedef marja getirir', () => {
  const v = JSON.parse(readFileSync(new URL('../ornek-veri.json', import.meta.url)));
  const s = hesapla(v);
  assert.ok(s.hedef.basaBasAdr > 0);

  const fiyatlaKar = (carpan) => hesaplaTemel(v, { fiyatCarpan: carpan });
  const bb = fiyatlaKar(s.hedef.basaBasAdr / s.oda.adr27);
  yakin(bb.kar27, 0, 1);

  const h = fiyatlaKar(s.hedef.hedefCarpan);
  yakin(h.marj27, v.varsayimlar.hedefKarMarji / 100, 1e-6);

  const bd = s.hedef.basaBasDoluluk;
  assert.ok(bd > 0 && bd < s.oda.doluluk27);
});

test('boş veri hata vermez', () => {
  const s = hesapla(bosVeri());
  assert.equal(s.gelir27, 0);
  assert.equal(s.kar27, 0);
});

test('2027 kararları: doğrudan maaş, çalışma ayı, oda adedi ve gider tutarı', () => {
  const v = veriOlustur({
    odalar: [{ adet: 10, adet2027: 12, fiyat2026: 1000, doluluk2026: 50, doluluk2027: 50 }],
    personel: [{ kisi2026: 1, maas2026: 1000, maas2027: 1500, ay: 12, ay2027: 6 }],
    giderler: [{ kategori: 'Kira', tip: 'sabit', tutar2026: 1000, tutar2027: 5000 }],
  });
  const s = hesaplaTemel(v);
  yakin(s.oda.satilan27, 12 * 100 * 0.5);
  const p = s.personel[0];
  yakin(p.maasOcak27, 1500);
  yakin(p.ocakZam, 50);
  // 3 ay 1500, 3 ay 1650, SGK %20
  yakin(p.maliyet27, (1500 * 3 + 1650 * 3) * 1.2);
  yakin(s.giderler[0].tutar27, 5000);
});

test('aylık personel: her ay farklı kişi sayısı, zamlar aya göre uygulanır', () => {
  const aylik = [0, 0, 0, 5, 10, 10, 10, 10, 10, 5, 0, 0]; // 60 kişi-ay
  const s = hesaplaTemel(veriOlustur({
    personel: [
      { maas2026: 1000, aylik2026: aylik },
      { maas2026: 1000, aylik2026: aylik, aylik2027: [0, 0, 0, 6, 12, 12, 12, 12, 12, 6, '', ''] },
    ],
  }));
  const [a, b] = s.personel;
  yakin(a.kisi26, 5);
  yakin(a.maliyet26, 60 * 1000 * 1.2);
  // 2027 = 2026 deseni; Nis-Haz 25 kişi-ay × 1100, Tem-Eki 35 kişi-ay × 1210
  yakin(a.maliyet27, (25 * 1100 + 35 * 1210) * 1.2);
  yakin(b.kisi27, 72 / 12);
  yakin(b.maliyet27, (30 * 1100 + 42 * 1210) * 1.2);
  assert.deepEqual(s.personelOzet.aylik26.slice(3, 6), [10, 20, 20]);
});

test('aylık personel: doluluğa bağlı satırlarda 2026 deseni ölçeklenir', () => {
  const s = hesaplaTemel(veriOlustur({
    odalar: [{ adet: 10, fiyat2026: 1000, doluluk2026: 50, doluluk2027: 60 }],
    personel: [{ maas2026: 1000, dolulugaBagli: true, aylik2026: [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10] }],
  }));
  assert.deepEqual(s.personel[0].aylik27, Array(12).fill(12));
});

test('sezon: 15 Mayıs - 30 Eylül açık gün ve aylık maaş oranları', () => {
  const d = donem({ calismaSekli: 'sezon', sezon2026Bas: '2026-05-15', sezon2026Bit: '2026-09-30' }, 2026);
  assert.equal(d.gun, 139);
  assert.deepEqual(d.aylar, [4, 5, 6, 7, 8]);
  yakin(d.oranlar[4], 17 / 30, 1e-9);
  assert.equal(d.oranlar[5], 1);
  // 2027 boşsa 2026 tarihleri kullanılır
  const d27 = donem({ calismaSekli: 'sezon', sezon2026Bas: '2026-05-15', sezon2026Bit: '2026-09-30' }, 2027);
  assert.equal(d27.bas, '2027-05-15');
  assert.equal(d27.gun, 139);
});

test('sezon: oda kapasitesi ve personel maliyeti sezona göre', () => {
  const v = veriOlustur({
    odalar: [{ adet: 10, fiyat2026: 1000, doluluk2026: 50 }],
    personel: [{ maas2026: 3000, aylik2026: ['', '', '', '', 10, 20, 30, 30, 20, '', '', ''] }],
  });
  Object.assign(v.otel, { calismaSekli: 'sezon', sezon2026Bas: '2026-05-15', sezon2026Bit: '2026-09-30' });
  const s = hesaplaTemel(v);
  yakin(s.oda.kapasite26, 1390);
  const p = s.personel[0];
  const kisiAy = 10 * (17 / 30) + 20 + 30 + 30 + 20;
  yakin(p.maliyet26, kisiAy * 3000 * 1.2);
  // 2027: Mayıs-Haziran Ocak maaşı (3300), Temmuz-Eylül Temmuz maaşı (3630)
  yakin(p.maliyet27, ((10 * 17 / 30 + 20) * 3300 + 80 * 3630) * 1.2);
  assert.equal(s.personelOzet.zirve26, 30);
});

test('toplam oda girişi: satılan oda-gece ve oda geliri ile', () => {
  const v = veriOlustur({
    odaGiris: 'toplam',
    odaToplam: { adet: 100, satilan2026: 10000, gelir2026: 40_000_000, satilan2027: 11000, fiyatZam: 25 },
  });
  Object.assign(v.otel, { calismaSekli: 'sezon', sezon2026Bas: '2026-05-15', sezon2026Bit: '2026-09-30' });
  const s = hesapla(v);
  yakin(s.oda.adr26, 4000);
  yakin(s.oda.doluluk26, 10000 / 13900, 1e-9);
  yakin(s.oda.satilan27, 11000, 1e-6);
  yakin(s.oda.adr27, 5000);
  yakin(s.oda.gelir27, 55_000_000, 1e-3);
  assert.equal(s.odalar[0].ad, 'Tüm odalar');
});
