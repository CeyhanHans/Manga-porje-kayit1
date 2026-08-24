# Doğrulama ve Teslim Durumu

## Kanıtlanmış

| Konu | Kanıt |
|---|---|
| Önceki demo teslim zinciri | `npm run verify:delivery` geçmişte PASS; paket kökleri `dist` ile hash düzeyinde karşılaştırılmıştır. |
| Eski güncel OCR demo birleşik paketi | Chromium + Firefox + Tesseract varlıkları içeren 46 girişli ZIP doğrulanmıştır. |
| Temel test altyapısı | TypeScript check, geometri, OCR cleanup, capture mapping ve content-package testleri oluşturulmuştur. |
| DeepL protokolü | Free endpoint, Authorization biçimi ve toplu `text` isteği kaynakta uygulanmıştır; geçmişte tek canlı cümle testi başarılı raporlanmıştır. |
| Firefox artefaktları | 0.5.3 ZIP/XPI dosyaları yerelde bulunmuştur. |
| Chromium artefaktı | 0.5.3 MV3 manifestli yüklenebilir klasör yerelde bulunmuştur. |

## Kanıtlanmamış veya kırık

| Konu | Neden |
|---|---|
| 0.5.3 yeniden üretilebilir build | Geçmiş kayıtta `npm test` derleme aşamasında OCR çıktısı eksik/erişim hatası vermiş, `verify:delivery` de eksik `README.txt` nedeniyle başarısız raporlanmıştır. Yeniden çalıştırılıp kayıt altına alınmalıdır. |
| 0.5.3 gerçek Chrome kalite kabulü | Kanıt yok. Ölçütler: beyaz kutu boyutu, OCR doğruluğu, çeviri doğruluğu, font, letter-spacing, konum. |
| Firefox Android cihaz akışı | Kanıt yok. |
| AMO/Chrome Web Store yüklemesi | Yapılmadı. |
| Merkezi backend akışı | Tasarlandı; uygulanmadı. |

## Yayın kapısı

Yayın/beta öncesi en az şunlar kanıtlanmalıdır:

1. Kaynaktan temiz build, test ve teslim doğrulaması.
2. Lisanslı en az 30 örnek görselde ölçülmüş OCR/çeviri/overlay değerlendirmesi.
3. Chromium masaüstü ve Firefox Android'de aç/kapat, zoom, resize, lazy-load, SPA geçişi, iptal/timeout/izin hatası senaryoları.
4. Store açıklaması, izin gerekçeleri, gizlilik politikası ve lisans/SBOM incelemesi.

## Test kuralı

Derlenmiş `content.js` dosyasının syntax kontrolü veya paket klasörünün bulunması, TypeScript kaynak zincirinin sağlam olduğu ya da ürünün çalıştığı anlamına gelmez.

