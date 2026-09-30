# Net Oda Fiyatı

Acentelere verilen komisyon dahil satış fiyatlarından otele kalan **net fiyatı** hesaplayan,
kendi bilgisayarınızda (localhost) çalışan bağımsız program. Bütçe programından ayrıdır.

## Çalıştırma

Tek gereksinim [Node.js](https://nodejs.org) (18 veya üzeri). Ek paket kurulumu gerekmez.

- **Windows:** `baslat.bat` dosyasına çift tıklayın.
- **Diğer:** bu klasörde `npm start` yazın.

Tarayıcıda **http://localhost:3001** açılır. (Bütçe programı 3000'de çalıştığı için ikisi aynı anda açık olabilir.)

## Kullanım

1. **Kayıtlı listeler:** Birden çok fiyat listesi isimle saklanır (ör. "2027 Yaz – Acenteler").
   **Yeni liste**, **kopya**, **sil**; listeler tablosundan eski listeler açılıp bakılabilir. Değişiklikler otomatik kaydedilir.
2. **Oranlar:** Acente komisyonu (varsayılan %20), Erken Rezervasyon indirimi,
   oda hesabının kaç kişi üzerinden yapılacağı (varsayılan 2 — odalar 3 kişilik olsa da).
3. **Fiyat listesi:** Dönem, oda tipi ve **kişi başı, TL** satış fiyatı. İstenirse dönem bazında farklı Erken Rezervasyon oranı.
4. **Hesap sırası:** önce Erken Rezervasyon indirimi, sonra komisyon düşülür:

   `NET = Satış × (1 − Erken Rez. %) × (1 − Komisyon %)`

   Örnek: 2.500 ₺ → %15 indirim → 2.125 ₺ → %20 komisyon → **1.700 ₺ net** (toplam kesinti %32, %35 değil).
   2 kişilik oda: satış 5.000 ₺ → **acentenin indirimli satış fiyatı (afiş fiyatı) 4.250 ₺** → net 3.400 ₺.
   Tabloda sarı sütun acentenin ilan edeceği indirimli oda fiyatı, yeşil sütunlar otele kalan nettir.
5. **Döviz (isteğe bağlı):** EUR / USD / GBP seçilir; kur elle yazılır veya **TCMB kurlarını getir** ile
   TCMB döviz alış kuru çekilir (internet gerekir). Döviz karşılığı = TL ÷ kur.
6. **Ters hesap:** hedef net fiyat yazılır, gereken satış fiyatı bulunur.
7. **PDF olarak al:** yazdırma penceresinde hedef olarak **"PDF olarak kaydet"** seçilir; A4 yatay, sade bir fiyat raporu çıkar.
8. **Excel'e aktar (CSV)** Türkçe Excel ile doğrudan açılır.

## Veriler

- Tüm listeler `data/fiyat-listeleri.json` dosyasına kaydedilir.
- Her günün ilk kaydında önceki hal `data/yedek/` klasörüne yedeklenir.
- Port değiştirmek için: `PORT=8081 npm start`.

## Test

```bash
npm test
```
