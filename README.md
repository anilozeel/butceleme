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

İlk açılışta 100 odalı örnek bir otel verisi gelir; üzerine kendi rakamlarınızı yazabilir veya
**Diğer → Boş bütçe başlat** ile sıfırdan başlayabilirsiniz.

## Sekmeler

| Sekme | Ne girilir / ne görülür |
|---|---|
| **2027 Zam Varsayımları** | Enflasyon beklentisi, oda fiyatı zammı, Ocak/Temmuz maaş zamları, SGK işveren payı, kurumlar vergisi, açık gün sayısı ve **kira, elektrik, vergi vb. kategorilere özel 2027 zamları** |
| **Odalar & Gelirler** | Oda tipleri, adet, 2026 fiyat ve doluluk, 2027 fiyat zammı ve hedef doluluk. Yiyecek-içecek, SPA gibi diğer gelirler |
| **Personel** | Departman, pozisyon, kişi sayısı, güncel brüt maaş, yan haklar, çalışma ayı, satır bazında zam. Departman özeti: kaç kişi çalışacağız |
| **Giderler** | Vergi ve harçlar, kira, elektrik, su, doğalgaz, komisyonlar, pazarlama, bakım, sigorta, genel giderler… |
| **Fiyat Hedefi & Senaryo** | Başa baş oda fiyatı, hedef kâr marjı için gereken fiyat (oda tipi bazında), başa baş doluluk, fiyat × doluluk senaryo tablosu |
| **Özet** | 2026 ve 2027 gelir-gider tablosu, net kâr, ADR, RevPAR, GOPPAR, gider dağılımı |

Satırlardaki zam kutuları **boş bırakılırsa** gri yazılı varsayılan kullanılır
(satır → kategori zammı → genel enflasyon).

## Hesaplama Mantığı

- **Oda geliri** = oda adedi × açık gün × doluluk × ortalama fiyat
- **2027 fiyat** = 2026 fiyat × (1 + zam)
- **Personel maliyeti** = kişi × brüt maaş × ay × (1 + SGK işveren payı) + yan haklar.
  2027'de çalışılan ayların ilk yarısı Ocak zammıyla, ikinci yarısı Ocak + Temmuz zammıyla hesaplanır.
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
- **Yazdır** özet sayfasını yazdırır (PDF olarak da kaydedilebilir).

Sunucu varsayılan olarak yalnızca bu bilgisayardan erişilebilir (`127.0.0.1`).
Port değiştirmek için: `PORT=8080 npm start`.

## Test

```bash
npm test
```
