# Faz 2 Uygulama Raporu

## Uygulanan özellik

- `TranslationResultV1` sürümlü DTO'su: görüntü boyutu, polygon, Türkçe metin ve confidence.
- `demo-result.ts` üzerinden iki sahte Türkçe region.
- Orijinal görsele dokunmayan, kapatılabilir fixed-position overlay.
- `resize`, `scroll`, görsel `load` olayı ve DOM mutasyonlarında yeniden konumlama.
- `object-fit` tabanlı source-pixel → görünür viewport dönüşümü.

## Otomatik kanıt

- `tests/geometry.test.mjs`, `contain` letterbox ve `cover` oran dönüşümünü denetler.
- Paketler `dist/chromium` ve `dist/firefox` altında ayrı manifestlerle üretilir.

## Bilinen sınırlar

- `object-position` merkezi olmayan kullanım ve karmaşık 3D/dönüş transformları garanti edilmez.
- SPA/lazy-load davranışı gözlemciyle ele alınır; hedef sitelerde manuel regression testi gerekir.
- Gerçek OCR/backend eklenmedi.


