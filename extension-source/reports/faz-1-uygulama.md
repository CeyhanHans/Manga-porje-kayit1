# Faz 1 Uygulama Raporu

## Uygulanan akış

Popup'taki kullanıcı eylemi background'a iletilir. Background, yalnız aktif sekmeye content script'i programatik olarak enjekte eder. Content script yalnız `<img>` öğelerinden kullanıcının tıkladığı tek görseli çerçeveler. Ağ isteği, OCR, çeviri ve backend yoktur.

## Kontroller

- `npm run check`: TypeScript denetimi.
- `npm run build`: Chromium ve Firefox yüklenebilir klasörleri.
- Yerel kullanıcı yönergeleri `README.md` içinde.

## Sınırlar

- Firefox Android fiziksel cihaz testi yapılmadı.
- SVG/canvas/CSS background seçim kapsamı dışındadır.


