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

## Geliştirme zinciri ve reload protokolü (DUZELTME-GÖREV3)

Tek geliştirme komutu **`npm run dev`** şu zinciri çalıştırır: `check → (build + test) → dist doğrulama`.
`npm test` başında build'i zaten çalıştırdığı için zincir ikinci kez derlemez.

**Bir kez hazırlanması gerekenler (temiz klon için):**

1. `npm ci`
2. `assets/ocr/eng.traineddata.gz` dosyasını yerelde sağlayın (10,9 MB — bilinçli olarak git'e
   girmez, `.gitignore` kapsamında). Doğrulanmış kaynak: çalışan dağıtım kopyasındaki
   `ocr-lang\eng.traineddata.gz` (SHA256 `ed350f37…46a2468`). Dosya yoksa build net hata verir.

**Her geliştirme döngüsünde (kesin reload protokolü):**

1. `npm run dev` — hedef `dist\chromium` altına üretilir; konsolda `Build ID: <commit>.<UTC zaman>` yazar,
   dosya hash'leri `outputs/build-hashes.txt`'ye alınır. `Desktop\chromium`'a kopyalama yapılmaz.
2. Chrome'da `chrome://extensions` → **geliştirme kartınıza** (yüklü klasör `…\extension-source\dist\chromium`
   olmalı) → karttaki reload simgesine bir kez basın.
3. Kartta hata bandı çıkmadığını doğrulayın; karttaki `version_name` değeri `0.5.3+<Build ID>` biçiminde
   yeni kimliği göstermeli.
4. Webtoon sekmesini tam yenileyin (Ctrl+Shift+R) — yenilenmedikçe eski content script sekmede kalır.
5. Uzantı popup'ını açın: alt satırdaki `Build:` değeri ile 1. adımdaki Build ID aynı olmalı.
   Farklıysa Chrome başka klasörden yüklü demektir — `chrome://extensions`'ta yüklü klasör yolunu
   kontrol edin.
6. İşlemi başlatın.

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

