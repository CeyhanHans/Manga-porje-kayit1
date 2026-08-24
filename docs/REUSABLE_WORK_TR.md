# Yeniden Kullanılabilir Çalışmalar ve Entegrasyon Kuralları

## Ana extension içinden korunacak parçalar

- Geometri: `contentRect`, `mapSourceRect`, `computeVisibleImageCrop`; CSS/natural image/device pixel ratio eşlemesini korur.
- Overlay yaşam döngüsü: `ResizeObserver`, `MutationObserver`, `AbortController`, zoom/resize/lazy-load sonrası konum güncellemesi.
- OCR hattı: Tesseract iframe + worker/WASM/dil varlıkları; OCR → cleanup/gruplama → bulk translation → box overlay sırası.
- Capture fallback: doğrudan görsel alma başarısızsa referer düzenleme ve `captureVisibleTab` yolu.
- OCR cleanup: düşük güven/gürültü filtresi ve koordinat tabanlı satır/bölge gruplama.
- Text fitting: font küçültme/satır sarma, minimum font, uzun kelime kırma, `Math.round` ile kararlı konum.

## `CeyhanHans/Projem-manga` destek kitinden alınabilecek parçalar

Bu repo ana extension'ın yerine geçmez; gözlem modunda ve testli entegrasyonla taşınacak bağımsız karar katmanıdır.

1. Medyan karakter yüksekliğiyle ölçeklenen kelime → satır → bölge gruplama.
2. Dar OCR bbox ile paddingli `balloonBox` ayrımı.
3. Düşük güvende crop/upscale/PSM/polarite içeren bölgesel yeniden OCR planı.
4. Koyu/açık metin için çift polariteli Sauvola, connected components, morfoloji ve OCR'sız metin adayı tespiti.
5. Çoklu OCR geçişinin kalite tabanlı erken durması ve koordinat/metin konsensüsü.
6. `fitTextToBox`, font profili, taşmayı sessiz kesmemek ve SVG debug overlay.
7. Tesseract v5 adaptörü, precision/recall/F1 değerlendirmesi ve 24/24 destek-kiti testleri.

## Uygulama sırası

1. Önce ana extension kaynak snapshot'ını yedekle ve buildi onar.
2. Destek kitini sadece debug/gözlem modunda bağla; mevcut OCR sonucu ile farkı ölç.
3. Gerçek, lisanslı fixture'larda düşük güvenli bölgeleri seç.
4. Yalnız seçilen düşük güvenli bölgelerde adaptif OCR'ı dene; kötüleşirse eski sonucu koru.
5. Önce OCR temizlemesi, sonra DeepL çağrısı; Türkçe sonuç üzerinde İngilizce OCR düzeltmesi çalıştırma.
6. Gerçek Canvas `measureText` ile fit algoritmasını bağla; letter-spacing'i ölçüme dahil et.
7. Her basamakta birim test + gerçek Chrome testi yap.

## Ertelenmesi gerekenler

- Beyaz maske ile sahte inpainting: renkli/dokulu balonları bozar.
- Dark/light balon rengi analizi: CORS-tainted canvas ve yanlış sınıflandırma riskini fixture/test olmadan alma.
- Ağır text detector/model veya Tesseract yeniden eğitimi: benchmark ve gerçek hata veri seti olmadan ekleme.

## Rate limit notu

`captureVisibleTab` çağrıları ile DeepL çağrıları için gerçek handler'lara bağlı bir kuyruk, 429 retry/backoff ve test gerekir. Tek başına sınıf tanımı yeterli değildir.

