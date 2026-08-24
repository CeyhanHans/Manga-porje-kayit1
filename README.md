# Manga Proje Kaydı 1

Bu private repo, **Manga Türkçe Overlay** WebExtension projesinin kalıcı devam kaydıdır.

## Başlangıç noktası

- Ana çalışma: `Manga Türkçe Overlay 0.5.3` yerel OCR + DeepL + sayfa üstü overlay prototipi.
- Hedef dağıtım: Chrome Web Store (masaüstü Chrome/Edge/ChromeOS) ve AMO (Firefox masaüstü/Android).
- Bu repo, geçmişteki planları, mevcut kodun kaynak haritasını, doğrulama kanıtını ve sonraki güvenli adımları bir arada tutar.

## Kesin durum

- Chromium MV3 ve Firefox MV2 ayrı manifest/background hedefleri vardır.
- Yerel Tesseract OCR varlıkları, OCR temizleme/gruplama, DeepL mesajlaşması ve responsive overlay kodlanmıştır.
- Firefox 0.5.3 ZIP/XPI çıktıları vardır; `C:\\Users\\user\\Desktop\\chromium` altında Chromium 0.5.3 yüklenebilir klasörü vardır.
- 0.5.3 için gerçek Chrome görsel kabul testi ve Firefox Android fiziksel cihaz testi kayda geçmiş değildir. Bu yüzden mağazaya hazır değildir.

## Bu repoyu yeniden açacak kişiye

Önce aşağıdaki belgeleri sırayla okuyun:

1. `docs/PROJECT_STATE_TR.md`
2. `docs/VERIFICATION_STATUS_TR.md`
3. `docs/REUSABLE_WORK_TR.md`
4. `docs/NEXT_STEPS_TR.md`
5. `docs/SOURCE_MAP_TR.md`

Kaynak snapshot, mevcut prototipin doğrulanmamış ama korunmuş TypeScript kaynaklarını `extension-source/` altında içerir. Herhangi bir değişiklikten önce build zincirini onarın ve gerçek Chrome kabul testini yapın.

## Güvenlik

API anahtarı, kullanıcı verisi, lisanssız manga görselleri ve browser storage dışa aktarımı bu repoya konmaz.

