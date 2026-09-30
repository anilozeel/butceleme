# Otel Bütçeleme 2027

2026 verilerinizden 2027 otel bütçesini oluşturan, kendi bilgisayarınızda (localhost) çalışan basit bir uygulama.

**Odayı kaçtan satmalıyız? Kaç kişi çalışmalı? 2027'de kâr ne olur?** sorularına cevap verir.

## Kurulum ve Çalıştırma

Tek gereksinim [Node.js](https://nodejs.org) (18 veya üzeri). Ek paket kurulumu gerekmez.

```bash
npm start
```

Tarayıcıda **http://localhost:3000** adresini açın.
Windows'ta `baslat.bat` dosyasına çift tıklamanız yeterli.

Program boş açılır. Bütçe üç adımda hazırlanır:

### 1 · 2026 Verileri — gerçekleşeni girin
| Sekme | Girilenler |
|---|---|
| **Odalar & Gelirler** | Yıl boyu açık mı, sezonluk mu (ör. 15 Mayıs – 30 Eylül); **toplam** oda sayısı, satılan oda-gece ve oda geliri — veya istenirse oda tiplerine göre; yiyecek-içecek, SPA gibi diğer gelirler |
| **Personel** | Departman, pozisyon, **her ay kaç kişi çalıştığı**, güncel **net** (veya brüt) maaş, yan haklar, SGK işveren payı, bordro parametreleri |
| **Giderler** | Vergi ve harçlar, kira, elektrik, su, doğalgaz, komisyonlar, pazarlama, bakım, sigorta, genel giderler… ve her birinin nasıl oluştuğu (sabit / değişken / gelirin yüzdesi) |

### 2 · 2027 Kararları — kararları verin
| Sekme | Karar verilenler |
|---|---|
| **Genel Zamlar** | Enflasyon beklentisi, oda fiyatı zammı, Ocak/Temmuz maaş zamları, 2027 sezon tarihleri, kira/elektrik/vergi gibi kategorilere özel zamlar |
| **Oda Fiyatı & Doluluk** | Oda fiyatı zammı, 2027 satılan oda hedefi (veya oda tipi bazında doluluk), oda sayısı değişimi |
| **Personel & Maaş** | 2027'de her ay kaç kişi çalışacağı, pozisyon bazında zam veya doğrudan yeni maaş, yeni pozisyonlar, aylık personel planı |
| **Gider Zamları** | Kalem bazında zam oranı veya kesinleşmiş 2027 tutarı (ör. kira sözleşmesi) |

### 3 · Sonuç
| Sekme | Görülenler |
|---|---|
| **Özet** | 2026 ve 2027 gelir-gider tablosu, net kâr, ADR, RevPAR, GOPPAR, gider dağılımı, departmanlara göre personel |
| **Fiyat Hedefi & Senaryo** | Başa baş oda fiyatı, hedef kâr marjı için gereken fiyat (oda tipi bazında), başa baş doluluk, fiyat × doluluk senaryo tablosu |

2027 kararlarında boş bırakılan kutularda gri yazılı varsayılan kullanılır
(satır → kategori zammı → genel oran). Hiç girilmeyen zam %0 kabul edilir.

Nasıl göründüğünü görmek için **Diğer → Örnek veriyi yükle** ile 100 odalı bir deneme oteli yükleyebilirsiniz.

## Hesaplama Mantığı

- **Sezon**: 15.05 – 30.09 gibi bir aralık girilirse açık gün sayısı (139) ve aylar tarihlerden hesaplanır.
  2027 tarihleri boş bırakılırsa 2026 ile aynı gün/ay kullanılır.
- **Toplam oda girişi**: ortalama fiyat = oda geliri ÷ satılan oda-gece; doluluk = satılan oda-gece ÷ (oda sayısı × açık gün).
- **Oda geliri** = oda adedi × açık gün × doluluk × ortalama fiyat
- **2027 fiyat** = 2026 fiyat × (1 + zam)
- **Net maaş → brüt**: SGK işçi payı (%14) + işsizlik (%1), kümülatif gelir vergisi dilimleri, asgari ücret
  gelir ve damga vergisi istisnası, damga vergisi (%0,759) eklenerek her ay için brüt bulunur.
  İşveren maliyeti = brüt + SGK işveren payı (SGK tavanına kadar). Asgari ücret ve vergi dilimleri
  "Bordro parametreleri" bölümünden değiştirilebilir; 2027 değerleri 2027 Kararları → Genel Zamlar'dadır.
  **Varsayılan parametreler tahminidir, mali müşavirinizle kontrol edin.**
- **Personel maliyeti** = Σ (o ay çalışan kişi × brüt maaş × ayın çalışılan oranı) × (1 + SGK işveren payı) + yan haklar.
  Sezonun ilk/son ayı kısmi ise maaş çalışılan gün ÷ 30 oranında sayılır (ör. 15–31 Mayıs = 17/30).
  2027'de Ocak–Haziran ayları Ocak maaşıyla (zam veya doğrudan girilen tutar), Temmuz–Aralık ayları Temmuz zamlı maaşla hesaplanır.
  2027'de bir ay boş bırakılırsa 2026'daki aynı ayın kişi sayısı kullanılır.
- **Doluluğa bağlı personel**: işaretlenen satırlarda 2027 kişi sayısı boşsa satılan oda artışı oranında önerilir.
- **Gider tipleri**
  - *Sabit*: 2026 tutar × (1 + zam) — kira, sigorta
  - *Değişken*: 2026 tutar × (satılan oda değişimi) × (1 + zam) — elektrik, su, yiyecek maliyeti
  - *Gelirin yüzdesi*: oda veya toplam gelir × oran — konaklama vergisi, acente komisyonu
- **Kurumlar vergisi** pozitif vergi öncesi kâr üzerinden hesaplanır. Amortisman ve faiz dahil değildir;
  isterseniz "Diğer Giderler" altına ekleyebilirsiniz.

## Veriler

- Her değişiklik otomatik olarak `data/butce.json` dosyasına kaydedilir.
- Her günün ilk kaydında bir önceki hal `data/yedek/` klasörüne yedeklenir.
- **Yedek indir / Yedek yükle** ile veriyi dosya olarak taşıyabilirsiniz.
- **Excel'e aktar (CSV)** Türkçe Excel ile doğrudan açılır.
- **PDF olarak al** özet sayfasını yazdırır; yazdırma penceresinde "PDF olarak kaydet" seçilir.

Sunucu varsayılan olarak yalnızca bu bilgisayardan erişilebilir (`127.0.0.1`).
Port değiştirmek için: `PORT=8080 npm start`.

## 2. Yazılım: Net Oda Fiyatı

**http://localhost:3000/net-fiyat.html** (veya üst menüden **Net Oda Fiyatı**)

Acentelere verilen komisyon dahil satış fiyatlarından otele kalan net fiyatı hesaplar. Fiyatlar **TL** girilir.

0. **Kayıtlı listeler:** Birden çok fiyat listesi isimle saklanır (ör. "2027 Yaz – Acenteler"); **Yeni liste**,
   **kopya**, **sil**; listeler tablosundan eski listeler açılıp bakılabilir. Değişiklikler otomatik kaydedilir.
1. **Oranlar:** Acente komisyonu (varsayılan %20), Erken Rezervasyon indirimi, oda hesabının kaç kişi üzerinden yapılacağı (varsayılan 2).
2. **Fiyat listesi:** Dönem, oda tipi ve **kişi başı** satış fiyatı. İstenirse dönem bazında farklı Erken Rezervasyon oranı.
3. **Hesap sırası:** önce Erken Rezervasyon indirimi, sonra komisyon düşülür:

   `NET = Satış × (1 − Erken Rez. %) × (1 − Komisyon %)`

   Örnek: 100 € → %15 indirim → 85 € → %20 komisyon → **68 € net** (toplam kesinti %32, %35 değil).
4. **Oda fiyatı** = kişi başı fiyat × 2 kişi (odalar 3 kişilik olsa da).
5. **Ters hesap:** hedef net fiyat yazılır, gereken satış fiyatı bulunur.
6. **Döviz (isteğe bağlı):** EUR / USD / GBP seçilir, kur elle yazılır veya **TCMB kurlarını getir** ile
   TCMB döviz alış kuru çekilir (internet gerekir). Net fiyatların döviz karşılığı = TL ÷ kur.
7. **PDF olarak al:** yazdırma penceresinde hedef olarak **"PDF olarak kaydet"** seçilir; A4 yatay, sade bir fiyat raporu çıkar.

Veriler `data/net-fiyat.json` dosyasına kaydedilir.

## Test

```bash
npm test
```
