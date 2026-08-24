# Bağımsız Demo Teftiş Notları

**Teftiş kapsamı:** Kaynak, `dist/`, `outputs/packages/`, teslim ZIP'i, manifestler, README, testler ve mevcut Faz raporları incelendi. Ürün kaynak kodu ve paket içeriği değiştirilmedi. Fiziksel tarayıcı/cihaz testi, uzantı yükleme, dış servis ve mağaza işlemi yapılmadı.

## Sonuç özeti

Demo iskeletinin beklenen masaüstü akışı kaynakta mevcut ve paketler birbirini tutuyor. Ancak gerçek tarayıcıda çalıştığına dair kanıt yoktur. Faz 3/gerçek ürün için uygun değildir; mevcut hali yalnız demo/teknik temel olarak değerlendirilmelidir.

## 1. Beklenen çalışma akışı

1. Kullanıcı Chromium veya Firefox paketini geliştirici modunda yükler (`README.md`, `outputs/packages/*/README.txt`).
2. Popup'taki **Bu görseli Türkçeye çevir** düğmesi `START_SELECTION` mesajını yollar (`src/popup/popup.ts`).
3. Background, aktif sekmeye mesajı yollar; alıcı yoksa content script'i yalnız o sekmeye enjekte eder (`src/background/background.ts`).
4. Content script, kullanıcıyı yalnız yüklenmiş bir `<img>` öğesi seçmeye alır; imleç altındaki görseli çerçeveler (`src/content/content.ts`).
5. Seçimde, sabit iki sahte Türkçe bölge overlay olarak gösterilir. Kapatma düğmesi veya popup'taki kapatma komutu overlay'i kaldırır.
6. Overlay, `resize`, `scroll`, görsel `load` ve gözlemlenen DOM değişikliklerinde yeniden hesaplanır.

## 2. Doğrudan kanıtlanan kontroller

| Kontrol | Kanıt | Sonuç |
| --- | --- | --- |
| Tip denetimi | `npm run check` | Geçti; `tsc --noEmit` hata vermedi. |
| Build ve birim test | `npm test` | Geçti; build tamamlandı, 2/2 Node testi geçti. |
| Geometri örnekleri | `tests/geometry.test.mjs` | Ortalanmış `contain` letterbox ve `cover` kaynak→ekran dönüşümü doğrulandı. |
| Hedef paket ayrımı | `src/manifest/manifest.chromium.json`, `src/manifest/manifest.firefox.json` | Chromium MV3/service worker; Firefox MV2/non-persistent background olarak ayrılmış. |
| Dağıtım eşitliği | `dist/{chromium,firefox}` ↔ `outputs/packages/{chromium,firefox}` SHA-256 karşılaştırması | Her iki hedefte dosya adları ve içerik hash'leri eşleşti. |
| Teslim ZIP'i | `outputs/manga-turkce-overlay-demo-paketleri.zip` | Her hedef için 6 dosya içeriyor: background, content, manifest, popup HTML/JS ve README. |
| Ağ/gizli anahtar yokluğu | `src/`, `dist/`, `outputs/packages/` taraması | `fetch`, XHR, HTTP(S), Authorization, API key ve `eval` eşleşmesi bulunmadı. |
| Üretim bağımlılığı denetimi | `npm audit --omit=dev --offline` | 0 güvenlik açığı raporlandı. |

## 3. Eksikler ve riskler

| Önem | Bulgu | Kanıt / Etki |
| --- | --- | --- |
| P1 — yüksek | Tarayıcı çalışma kanıtı yok. | `README.md` ve `reports/faz-1-uygulama.md` fiziksel Firefox Android testinin yapılmadığını söyler; Chromium/Firefox desktop için de ekran kaydı, konsol çıktısı veya manuel test kaydı bulunmuyor. Manifest/API uyumsuzluğu ya da seçici etkileşim sorunu paket yüklenmeden tespit edilemez. |
| P1 — yüksek | Test edilen geometri ile çalışan content-script geometrisi iki ayrı kopya. | Test `build/src/shared/geometry.js` dosyasını çağırır (`tests/geometry.test.mjs`); uzantı ise aynı mantığı kendi içinde tanımlar (`src/content/content.ts`). Değişikliklerde test yeşilken dağıtılan kod bozulabilir. |
| P2 — orta | Overlay yaşam döngüsü dinleyicileri temizlenmiyor. | Her `showOverlay` çağrısı yeni `resize`, `scroll`, `load` dinleyicileri ekler; `removeOverlay` bunları kaldırmaz (`src/content/content.ts`). Tekrarlanan kullanımda gereksiz yeniden çizim ve bellek/CPU yükü oluşabilir. |
| P2 — orta | Tüm belge üzerinde geniş `MutationObserver` kullanımı performans riski. | `document.documentElement` alt ağacında `childList` ile `style`, `class`, `src`, `width`, `height` niteliği gözleniyor (`src/content/content.ts`). Manga okuyucularındaki yoğun lazy-load/SPA DOM hareketinde fazla güncelleme üretebilir. |
| P2 — orta | Konum hesabının sınırları manuel test edilmedi. | `object-position` (merkez dışı), dönüş/3D transform, canvas/SVG/CSS background desteklenmiyor veya garanti edilmiyor (`README.md`, `reports/faz-2-uygulama.md`). Polygonlar da bounding-box'a indirgeniyor; eğik/karmaşık balon şekli maskelenmiyor. |
| P2 — orta | Firefox Android uyumluluğu belirsiz. | Ayrı MV2/event-page manifesti tasarlanmış olsa da gerçek cihazda `activeTab`, `tabs.executeScript`, popup davranışı ve yükleme akışı doğrulanmamış (`specs/platform-matrix.md`). |
| P3 — düşük | İzinler işlevle tam eşleşmiyor. | Her iki manifest `storage` ister ama kaynakta `storage` kullanımı yok. Chromium'da `scripting` programatik enjeksiyon için kullanılıyor; Firefox hedefinde `tabs.executeScript` çağrısının gerçek cihaz doğrulaması gerekir. Gereksiz izin kullanıcı güvenini azaltır. |
| P3 — düşük | Hata/erişilebilirlik UX'i sınırlı. | Popup genel bir hata mesajı gösterir; içerik seçim modunda Escape dışında görünür iptal yönergesi yok. Keyboard-only seçimi ve canlı durum/odak yönetimi yok (`src/popup/popup.html`, `src/content/content.ts`). |

## 4. Fiziksel test adımları

1. Temiz build üretin: proje kökünde `npm run check`, `npm test`, sonra `npm run build`.
2. Chrome veya Edge'de `chrome://extensions` → Geliştirici modu → **Paketlenmemiş öğe yükle** → `dist/chromium` seçin. Uzantı hataları ve servis worker konsolunu kaydedin.
3. Yerel veya izinli bir test sayfasına farklı en-boy oranlarında en az üç `<img>` ekleyin: normal, `object-fit: contain`, `object-fit: cover`. Popup'tan başlatın, görseli seçin; iki overlay metninin görsel üzerinde ve kapatma düğmesinin çalıştığını kontrol edin.
4. Aynı seçili görselde pencereyi yeniden boyutlandırın, sayfayı yukarı/aşağı kaydırın, `src` değeri sonradan değişen bir lazy-load görseli kullanın ve SPA benzeri DOM değişimi tetikleyin. Her durumda overlay konumunu ekran görüntüsüyle kaydedin.
5. Yeni görsel seçme ve popup'tan **Overlay'i kapat** akışını art arda en az 10 kez deneyin; performans profilinde dinleyici/güncelleme çoğalmasını inceleyin.
6. Firefox desktop'ta `about:debugging#/runtime/this-firefox` → **Geçici Eklenti Yükle** → `dist/firefox/manifest.json`; 2–5'i tekrarlayın ve Browser Console hatalarını kaydedin.
7. Firefox Android için yalnız geliştirme/sideload politikasına uygun test cihazında Mozilla'nın resmi uzaktan hata ayıklama akışını kullanın. Popup erişimi, `activeTab` sonrası enjeksiyon ve sayfa geçişi davranışını tekrar doğrulamadan Android desteği iddia etmeyin.

## 5. Faz 3 / gerçek ürün engelleri

- Gerçek OCR+çeviri sağlayıcısı, maliyet/kota, lisans ve iki kullanım izni kayıtlı test görseli seçilmemiş (`reports/faz-3-plan-ve-maliyet-kararlari.md`).
- Merkezi HTTPS backend yalnız sözleşme/tehdit modeli seviyesinde; çalışan servis, kimlik doğrulama, oran sınırı, kötüye kullanım önlemi, gözlemlenebilirlik ve veri saklama uygulaması yok (`specs/backend-api-contract.md`, `specs/backend-threat-model.md`).
- Kullanıcı onayı olmadan API anahtarı, ücretli/sandbox servis, sunucu yayını ve mağaza dağıtımı başlatılamaz.
- Ürüne geçmeden önce P1 bulguları kapatılmalı: Chromium/Firefox desktop çalışma kanıtı, Firefox Android fiziksel uyumluluk kararı ve content-script'in gerçekten test edilen ortak geometri modülünü kullanması.

## Teftiş kararı

**Kritik (P0) bulgu yoktur; ancak iki P1 bulgusu nedeniyle demo doğrulanmış ürün olarak kabul edilmemeli ve Faz 3 uygulamasına geçilmemelidir.** Önce fiziksel test kanıtı ile test mimarisi ayrışması kapatılmalıdır.

