# Güncel Bağımsız Demo Teftişi

**Tarih:** 2026-08-17  
**Kapsam:** `src/`, mevcut `build/` ve `dist/`, `outputs/packages/`, ZIP, testler, manifestler ve `outputs/teftis-duzeltmeleri.md`.  
**Yöntem:** Yalnız-okunur dosya incelemesi, SHA-256 karşılaştırması, mevcut Node testlerinin çalıştırılması ve çalışma zamanı kodu taraması. Kod, paket, ZIP veya dış servis değiştirilmedi; tarayıcı/mağaza/uzantı kurulumu yapılmadı.

## Sonuç

**Geçiş kararı: FAIL — dağıtım teslimi geçişe hazır değil.**

Kaynak kodu ile güncel `dist/` çıktısında ortak geometri ve overlay cleanup düzeltmeleri bulunuyor. Ancak `outputs/packages/` kök klasörleri ve teslim ZIP’inin kök girişleri eski paketleri taşıyor. ZIP ayrıca güncel dosyaları iç içe `chromium/chromium/` ve `firefox/firefox/` yollarında bulunduruyor; kullanıcı kök klasörü yüklerse eski içerik ve gereksiz `storage` izniyle karşılaşır. Bu, P1 düzeyinde doğrudan dağıtım bütünlüğü hatasıdır.

## Bulgular

### 1. Ortak geometri kaynağı ve test kapsamı — P1, kısmen PASS / teslimde FAIL

**Kanıt / PASS:**

- `src/shared/geometry.ts:4,19` ortak `contentRect`, `polygonBounds` ve `mapSourceRect` fonksiyonlarını tanımlar.
- `src/content/content.ts:12,45,59` content script bu API’yi `MangaTrGeometry` üzerinden kullanır; geometriyi yeniden tanımlamaz.
- `scripts/build.mjs:23-24` derlenmiş ortak geometriyi işaretli prelude olarak dağıtılan content script’e gömer.
- `dist/chromium/content.js` ve `dist/firefox/content.js` 9,209 bayt ve SHA-256 `61995CB4F0958B3809508C5D255BB6FDE0ACF757B0D463E6EBA5E74523028163`; her ikisinde de `MANGA_TR_GEOMETRY_START/END` işaretleri var.
- `tests/content-package.test.mjs:7-12` dağıtılan Chromium content script’inin gömülü geometrisini gerçekten çalıştırıyor. `tests/geometry.test.mjs` ile birlikte mevcut iki test dosyası çalıştırıldı: **3/3 geçti**.

**FAIL:**

- `outputs/packages/chromium/content.js` ve `outputs/packages/firefox/content.js` 8,215 bayt, SHA-256 `E0E5B68D57B3B77D24FEA289925565995D1C7077A084C323E8083396022E3FA6`; gömülü ortak geometri işareti/API’si yok ve eski overlay kodu kullanılıyor.
- Test yalnız `dist/chromium/content.js`’yi kapsıyor; Firefox `dist` çıktısını, paket köklerini veya ZIP girişlerini kapsamıyor.

**Öneri:** Paketleme tek bir kaynak dizinden yapılmalı; ZIP’te hedef klasör başına tam olarak bir yüklenebilir kök bulunmalı. Test, `dist/chromium`, `dist/firefox`, her iki paket kökü ve ZIP girişlerini hash/içerik/API bakımından doğrulamalı.

### 2. Overlay event listener / observer cleanup — P1, güncel dist PASS; eski teslim FAIL

**Kanıt / PASS:**

- `src/content/content.ts:28` `removeOverlay()` mevcut cleanup fonksiyonunu çağırıyor.
- `src/content/content.ts:73-78` `AbortController` ile `resize`, `scroll` ve image `load` dinleyicileri; ayrıca image `MutationObserver`, belge bağlantı gözlemcisi ve `ResizeObserver` temizleniyor.
- `src/content/content.ts:90-91` seçim modunun `mousemove`, `click` ve `keydown` dinleyicileri ayrı cleanup ile kaldırılıyor.
- Aynı cleanup yapısı güncel `dist` ve iç içe paket kopyalarında mevcut.

**FAIL / sınır:**

- Paket kökündeki eski `content.js` dosyalarında `AbortController` ve yeni cleanup yapısı yok; yalnız tek bir `observer` tutuluyor ve geniş belge attribute gözlemi yapılıyor. Bu dosyalar gerçek yükleme hedefi olarak seçilirse düzeltme uygulanmamış sürüm çalışır.
- Kod incelemesi fiziksel tarayıcıda tekrarlı seçim/overlay akışını kanıtlamaz.

**Öneri:** Eski kök paketleri kaldırıp güncel tekil paketleri yeniden üretin; ardından aynı sayfada en az 10 seçim/kapatma döngüsünü gerçek tarayıcıda doğrulayın.

### 3. Minimum izinler — P1, kaynak/dist PASS; teslim kökü FAIL

**Kanıt / PASS:**

- Kaynak manifestleri `src/manifest/manifest.chromium.json:8` (`activeTab`, `scripting`) ve `src/manifest/manifest.firefox.json:8` (`activeTab`) kullanıyor.
- Güncel `dist` ve iç içe paket manifestleri aynı minimum izinleri taşıyor.
- Runtime kodunda `storage` kullanımı bulunmadı.

**FAIL:**

- `outputs/packages/chromium/manifest.json:8` izinleri `activeTab`, `storage`, `scripting`; `outputs/packages/firefox/manifest.json:8` izinleri `activeTab`, `storage`.
- ZIP’in kök `chromium/manifest.json` ve `firefox/manifest.json` girişleri de bu gereksiz `storage` iznini taşıyor.

**Öneri:** `storage` içeren kök paketleri ve ZIP girişlerini teslimattan çıkarın; izin testi doğrudan tüm teslim hedeflerini kontrol etsin.

### 4. Güncel build ile paket/ZIP hash ve içerik eşleşmesi — P1 FAIL

**Kanıt:**

- `dist/chromium` ve `dist/firefox` birbirleriyle ve ZIP’in iç içe `chromium/chromium/*` / `firefox/firefox/*` girişleriyle eşleşiyor. Örnek: güncel `content.js` SHA-256 `61995CB4...028163`, `background.js` SHA-256 `CFE0F2F4...E820EC`.
- Buna karşılık paket kökü content dosyaları `E0E5B68D...E3FA6` hash’inde; kök Chromium manifesti `C1ABDEDF...3731B3`, kök Firefox manifesti `A7CC6E52...73E89F` hash’inde. Güncel dist manifest hash’leri sırasıyla `46099E6A...7AB56` ve `0DC71BE9...29F43`.
- ZIP kökü, eski dosyaları; iç içe klasörler, güncel dosyaları içeriyor. Aynı teslimde iki farklı sürüm ve yinelenen yükleme yapısı var.

**Öneri:** ZIP’i temiz bir staging dizininden yeniden üretin; her hedefte `manifest.json`, `content.js`, `background.js`, `popup.*` ve README yalnız bir kez bulunmalı. Yeniden üretimden sonra SHA-256 manifesti CI’da karşılaştırılmalı.

### 5. Gizli anahtar ve ağ çağrısı — P3 PASS (kapsamlı ama statik)

**Kanıt:** `src/`, `build/`, `dist/` ve `outputs/packages/` içindeki çalışma zamanı `.ts/.js/.json/.html` dosyalarında `fetch`, `XMLHttpRequest`, `WebSocket`, HTTP(S) URL, API anahtarı, `Authorization`, Bearer, parola/gizli anahtar, `eval` eşleşmesi bulunmadı. `package-lock.json` içindeki npm registry URL’leri bağımlılık metadata’sıdır; uzantının çalışma zamanı çağrısı değildir.

**Sınır:** Bu statik tarama obfuscation veya gelecekteki dış bileşenleri kanıtlamaz; mevcut demo çalışma zamanını kapsar. Dış servis, mağaza ve tarayıcı uzantısı yükleme yapılmadı.

## Test ve doğrulama kaydı

- `node --test tests/*.test.mjs`: **3 test geçti, 0 başarısız**. Build çalıştırılmadı; çünkü istenen yalnız-okunur teftişte build mevcut dağıtım çıktısını değiştirebilir.
- Fiziksel Chrome/Edge, Firefox desktop veya Firefox Android testi yapılmadı.
- Uzantı yükleme, mağaza işlemi, dış servis erişimi ve paket kurulumu yapılmadı.

## Son karar

**FAIL.** Kaynak ve güncel `dist` tarafındaki geometri/cleanup düzeltmeleri doğrulanmış olsa da, teslim ZIP’i ve paket kökleri güncel build ile eşleşmiyor ve gereksiz `storage` izni içeriyor. Önce paketleme/ZIP yapısı tek sürüme indirilmeli; sonra testler tüm teslim hedeflerini kapsamalı ve fiziksel tarayıcı testi ayrıca yapılmalıdır.

