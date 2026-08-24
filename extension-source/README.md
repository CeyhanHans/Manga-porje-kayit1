# Manga Türkçe Overlay 0.5.3

Firefox ve Chromium için manga görsellerindeki İngilizce metni yerel Tesseract OCR ile algılayıp DeepL API üzerinden Türkçeye çeviren WebExtension.

## Özellikler

- Tesseract.js, İngilizce dil modeli ve WASM çekirdeği paket içinde yerel çalışır.
- OCR satırları yakınlıklarına göre gruplanıp cümle halinde çevrilir.
- Türkçe metin görselin üzerinde, metin kutusuna sığacak şekilde gösterilir.
- Korumalı görsel sunucularında Referer düzenleme ve görünür sekme yakalama yedeği bulunur.
- DeepL API anahtarı kullanıcı tarafından popup'a girilir ve yalnız tarayıcının yerel eklenti depolamasında saklanır.
- Firefox masaüstü 140+ ve Firefox Android 142+ hedeflenir.

## Kaynaktan üretme

Doğrulanan ortam: Node.js 24.19.0 ve npm 11.17.0.

```powershell
npm ci
npm run check
npm test
npm run package
npm run verify:delivery
```

Üretilen Firefox dosyaları `dist/firefox` altında, doğrulanan teslim kopyası `outputs/packages/firefox` altında oluşur. Mağazaya gönderilen ZIP, `dist/firefox` klasöründen Mozilla `web-ext build` ile üretilir.

## Test

```powershell
npx web-ext lint --source-dir dist/firefox
npx web-ext run --source-dir dist/firefox --firefox "C:\Program Files\Mozilla Firefox\firefox.exe"
```

Firefox Android cihaz testi için Android Platform Tools ve USB hata ayıklaması gerekir:

```powershell
npx web-ext run --target firefox-android --source-dir dist/firefox --android-device <cihaz-kodu> --firefox-apk org.mozilla.firefox
```

## Gizlilik

Görsel OCR işlemi cihazda yapılır. Algılanan metin ve kullanıcının DeepL kimlik doğrulama anahtarı çeviri isteği için DeepL API'ye gönderilir. Paket içinde API anahtarı bulunmaz.

