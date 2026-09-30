import { test } from 'node:test';
import assert from 'node:assert/strict';
import { netHesapla, gerekenSatis, netTablo } from '../public/net-fiyat-calc.js';

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
