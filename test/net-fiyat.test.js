import { test } from 'node:test';
import assert from 'node:assert/strict';
import { netHesapla, gerekenSatis, netTablo, depoHazirla, tcmbKurlariniOku } from '../public/net-fiyat-calc.js';

const yakin = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b}`);

test('önce erken rezervasyon, sonra komisyon düşülür', () => {
  const r = netHesapla(100, 15, 20);
  yakin(r.ebIndirim, 15);
  yakin(r.ebSonrasi, 85);
  yakin(r.komisyon, 17);
  yakin(r.net, 68);
  yakin(r.toplamKesinti, 0.32);
});

test('%20 + %20 toplam kesinti %36', () => {
  yakin(netHesapla(50, 20, 20).toplamKesinti, 0.36);
});

test('ters hesap: hedef nete göre satış fiyatı', () => {
  yakin(gerekenSatis(68, 15, 20), 100);
});

test('tablo: kişi başı ve 2 kişilik oda, satır bazında erken rezervasyon', () => {
  const t = netTablo({
    ayarlar: { komisyon: 20, erkenRez: 10, kisi: 2 },
    fiyatlar: [{ fiyat: 100, erkenRez: '' }, { fiyat: 200, erkenRez: 25 }],
  });
  yakin(t.satirlar[0].net, 72);
  yakin(t.satirlar[0].odaNet, 144);
  yakin(t.satirlar[1].net, 120);
  yakin(t.satirlar[1].odaSatis, 400);
  yakin(t.ortalama.net, 96);
});

test('döviz çevirisi: TL fiyat ÷ kur', () => {
  const t = netTablo({
    ayarlar: { komisyon: 20, erkenRez: 0, kisi: 2, doviz: 'EUR', kurlar: { EUR: 50 } },
    fiyatlar: [{ fiyat: 5000 }],
  });
  yakin(t.satirlar[0].net, 4000);
  yakin(t.satirlar[0].dNet, 80);
  yakin(t.satirlar[0].dOdaNet, 160);
  const tl = netTablo({ ayarlar: { komisyon: 20, doviz: '' }, fiyatlar: [{ fiyat: 5000 }] });
  assert.equal(tl.satirlar[0].dNet, null);
});

test('eski tek liste kaydı listeye çevrilir', () => {
  const d = depoHazirla({ ayarlar: { baslik: 'Yaz', komisyon: 18, paraBirimi: '€' }, fiyatlar: [{ fiyat: 1 }] });
  assert.equal(d.listeler.length, 1);
  assert.equal(d.listeler[0].ad, 'Yaz');
  assert.equal(d.listeler[0].ayarlar.komisyon, 18);
  assert.equal(d.listeler[0].ayarlar.paraBirimi, undefined);
  assert.equal(d.aktifId, d.listeler[0].id);
  assert.equal(depoHazirla({}).listeler.length, 1);
});

test('TCMB kur XML okunur', () => {
  const xml = `<Tarih_Date Tarih="30.09.2026" Date="09/30/2026">
    <Currency CrossOrder="0" Kod="USD" CurrencyCode="USD"><Unit>1</Unit><ForexBuying>41.5012</ForexBuying><ForexSelling>41.5760</ForexSelling></Currency>
    <Currency CrossOrder="9" Kod="EUR" CurrencyCode="EUR"><Unit>1</Unit><ForexBuying>48.7020</ForexBuying><ForexSelling>48.7898</ForexSelling></Currency>
  </Tarih_Date>`;
  const r = tcmbKurlariniOku(xml);
  assert.equal(r.kurlar.USD, 41.5012);
  assert.equal(r.kurlar.EUR, 48.702);
  assert.equal(r.kurlar.GBP, undefined);
  assert.equal(r.tarih, '30.09.2026');
});
