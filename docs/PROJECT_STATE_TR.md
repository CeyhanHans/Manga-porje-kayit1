# Manga Türkçe Overlay — Kalıcı Proje Durumu

Son güncelleme: 2026-08-24

## Amaç

İngilizce manga/webtoon görsellerindeki metni kullanıcı eylemiyle OCR edip Türkçeye çeviren ve orijinal görseli değiştirmeden responsive overlay olarak gösteren bir WebExtension.

## Ürün ve dağıtım kararı

| Kanal | Hedef | Teknik hedef |
|---|---|---|
| Chrome Web Store | Masaüstü Chrome/Edge/ChromeOS | Chromium Manifest V3, service worker |
| AMO | Firefox masaüstü ve Firefox Android | Ayrı Firefox uyumlu Manifest V2/event-page background |

Mobil Chrome ilk dağıtım kanalı değildir. Android telefon desteği Firefox Android/AMO üzerinden planlanmıştır.

## Gerçekleşen aşamalar

### Faz 0 — Ürün sözleşmesi ve risk analizi: tamamlandı

Platform matrisi, MVP kapsamı, gizlilik/güvenlik, backend API sözleşmesi ve tehdit modeli yazıldı. Esas karar: merkezi HTTPS backend hedefi, minimum izinler, ayrı Chromium/Firefox yapıları ve overlay-first MVP.

### Faz 1 — Uzantı iskeleti ve görsel seçimi: tamamlandı

Popup, content script, kullanıcının seçtiği görsel, overlay yaşam döngüsü ve ayrı build/manifest hedefleri kuruldu.

### Faz 2 — Overlay/geometri/test verisi: tamamlandı

Sahte region verisi ile responsive overlay; object-fit, resize, sayfa değişimi, lazy-load ve geometri yardımcıları eklendi. İlk demo teslim zinciri bağımsız teftişten geçti.

### Sonraki prototip akışı — Yerel OCR + DeepL: kısmen tamamlandı

Tesseract worker/WASM/dil varlıkları, OCR iframe'i, OCR temizleme ve koordinata göre grup oluşturma eklendi. Content script OCR bölgelerini background'a toplu çeviri için gönderir; background DeepL Free API çağrısını yapar; sonuç overlay olarak çizilir. Korunan görsel sunucuları için referer düzenleme ve görünür sekme yakalama fallback'i vardır.

## Mevcut sürüm izleri

- Kaynak/masaüstü manifest sürümü: `0.5.3`.
- Firefox 0.5.3 ZIP, unsigned XPI, Android ZIP/XPI ve AMO source ZIP üretildi.
- Chromium 0.5.3 yüklenebilir klasörü `C:\\Users\\user\\Desktop\\chromium` altında görüldü.
- Önceki 0.4.0 Chrome görsel testinde aşırı büyük beyaz kutular, OCR gürültüsü ve zayıf çeviri kalitesi görüldü.
- 0.5.3'ün bu sorunları gerçek manga görselinde giderdiğini kanıtlayan kayıt bulunmadı.

## Bilinçli sınırlar

- Gerçek inpainting yoktur; overlay yaklaşımı kullanılır.
- Merkezi backend, kimlik doğrulama, kota, cache politikası ve job yaşam döngüsü uygulanmış değildir.
- API anahtarı client tarafı extension storage'da tutulduğu için üretim güvenlik modeli değildir.
- Yalnızca statik/build/paket kontrolü gerçek tarayıcı veya cihaz kanıtı sayılmaz.

