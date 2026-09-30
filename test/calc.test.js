import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hesapla, hesaplaTemel, bosVeri } from '../public/calc.js';

const yakin = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b}`);

function veriOlustur(ekle = {}) {
  const v = bosVeri();
  v.otel.acikGun2026 = 100;
  v.otel.acikGun2027 = 100;
  Object.assign(v.varsayimlar, { enflasyon: 10, odaFiyatZam: 20, ocakZam: 10, temmuzZam: 10, sgkIsveren: 20, kurumlarVergisi: 25, hedefKarMarji: 20 });
  return { ...v, ...ekle };
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
