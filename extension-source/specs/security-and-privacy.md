# Güvenlik ve Gizlilik

## Bugünkü demo sürümü

- Görsel seçimi yalnız popup'taki açık kullanıcı eyleminden sonra yapılır.
- Görsel baytı, sayfa URL'si veya OCR sonucu ağ üzerinden gönderilmez.
- Kalıcı cache, telemetri ve API anahtarı yoktur.
- İzinler: `activeTab`, `storage`; Chromium paketi programatik içerik betiği için `scripting` kullanır.

## Gerçek backend eklendiğinde zorunlu kontroller

- Sadece HTTPS; backend hostu için en dar host izni.
- Kullanıcı/cihaz oturumu, kota ve rate limit.
- MIME, boyut, piksel sayısı, sıkıştırma oranı ve timeout doğrulaması.
- İstemci yalnız doğrulanmış görüntü baytlarını yollar; backend keyfi URL indirmez.
- Job sahipliği, kısa TTL, idempotency anahtarı ve kısa ömürlü kullanıcıya bağlı sonuç URL'leri.
- Ham görüntü/OCR/çeviri kullanıcı verisidir: saklama süresi, silme, loglar, sağlayıcı aktarımı ve destek erişimi açıkça beyan edilir.

## Yasaklar

- Uzantı paketinde API anahtarı, uzaktan çalıştırılan kod/WASM veya geniş sürekli site erişimi bulunmaz.
- Kullanıcı eylemi olmadan sayfa taraması veya görsel gönderimi yapılmaz.


