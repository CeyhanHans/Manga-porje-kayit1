# Güncel Bağımsız Demo Teftişi — Teslim Zinciri

**Tarih:** 2026-08-17  
**Kapsam:** `npm run verify:delivery`, `outputs/packages/` kökleri, `dist/`, teslim ZIP’i ve önceki P1 teslim bütünlüğü bulguları.  
**Yöntem:** Yalnız-okunur komut çalıştırma, dosya/entry listesi incelemesi ve SHA-256 karşılaştırması. Kod veya paket değiştirilmedi; tarayıcı uzantısı yüklenmedi ve dış servis kullanılmadı.

## Nihai geçiş kararı

**PASS — önceki P1 teslim bütünlüğü bulgusu kapanmıştır.**

Teslim doğrulama komutu başarılıdır. Paket kökleri artık güncel `dist` ile byte/hash düzeyinde eşleşiyor; ZIP yalnızca tekil, doğru hedef yollarını içeriyor. Eski content script/cleanup ve `storage` izni paket köklerinden ve ZIP’ten kaldırılmıştır.

Bu karar yalnız teslim zincirini kapsar. Fiziksel tarayıcı/cihaz çalışma testi bu teftişte yapılmamıştır.

## Kontroller ve kanıt

### 1. `npm run verify:delivery` — P0/P1 FAIL yok, PASS

Çalıştırılan komut:

```text
npm run verify:delivery
```

Sonuç:

```text
Delivery packages verified from C:\Users\user\Documents\Codex\2026-08-17\bu-raporu-proje-s-zle-mesi-2\
```

`scripts/verify-delivery.mjs` her hedef için şunları doğruluyor: beklenen altı dosyadan oluşan paket kökü, `dist` ile SHA-256 eşitliği, geçerli JSON, `storage` izninin yokluğu ve `content.js` içinde `MANGA_TR_GEOMETRY_START` ile `AbortController` bulunması.

### 2. `outputs/packages` kökleri — P1 PASS

Her iki kök tam olarak şu altı dosyayı içeriyor; iç içe `chromium/` veya `firefox/` klasörü yok:

```text
README.txt
background.js
content.js
manifest.json
popup.html
popup.js
```

Dosya boyutları da güncel `dist` ile uyumlu:

- Chromium: `content.js` 9,209 bayt, `manifest.json` 356 bayt.
- Firefox: `content.js` 9,209 bayt, `manifest.json` 534 bayt.

Önceki bulgudaki eski 8,215 baytlık content script ve yinelenen paket ağacı artık mevcut değil.

### 3. ZIP entry listesi — P1 PASS

ZIP şu 12 tekil entry’yi içeriyor:

```text
chromium/{background.js,content.js,manifest.json,popup.html,popup.js,README.txt}
firefox/{background.js,content.js,manifest.json,popup.html,popup.js,README.txt}
```

`chromium/chromium/*` veya `firefox/firefox/*` gibi yinelenen iç içe entry bulunmadı. ZIP kökleri doğrudan yüklenebilir hedef klasörlerdir.

### 4. `dist` → paket hash eşleşmesi — P1 PASS

Chromium ve Firefox için beklenen altı dosyanın tamamı `dist/{target}` ile `outputs/packages/{target}` arasında eşleşti.

Önemli SHA-256 kanıtları:

| Hedef/dosya | SHA-256 |
| --- | --- |
| Chromium `content.js` | `61995CB4F0958B3809508C5D255BB6FDE0ACF757B0D463E6EBA5E74523028163` |
| Firefox `content.js` | `61995CB4F0958B3809508C5D255BB6FDE0ACF757B0D463E6EBA5E74523028163` |
| Chromium `manifest.json` | `46099E6A2E2EA0C0F139D5AA34B4486956D7E96C960040F0488F5CDB9417AB56` |
| Firefox `manifest.json` | `0DC71BE9B07A810C7F330EC489CCA8397348506B99CB5F97A408F0792BC29F43` |
| `background.js` — iki hedef | `CFE0F2F495360CD8C95061AADC081A17A1348FB1A5EC30783494D98651E820EC` |

### 5. Paket → ZIP hash eşleşmesi — P1 PASS

Her iki hedefteki altı paketin tamamı ZIP içindeki karşılık gelen entry ile SHA-256 düzeyinde eşleşti. Özellikle:

- Paket ve ZIP `content.js`: `61995CB4F0958B3809508C5D255BB6FDE0ACF757B0D463E6EBA5E74523028163`.
- Paket ve ZIP Chromium manifesti: `46099E6A2E2EA0C0F139D5AA34B4486956D7E96C960040F0488F5CDB9417AB56`.
- Paket ve ZIP Firefox manifesti: `0DC71BE9B07A810C7F330EC489CCA8397348506B99CB5F97A408F0792BC29F43`.

### 6. Önceki P1 göstergeleri — PASS

- **Kökte eski content script:** Kapanmış. Paket kökleri güncel 9,209 baytlık content script’i taşıyor.
- **Cleanup düzeltmesinin yokluğu:** Kapanmış. Kök paket content script’lerinde `AbortController` bulunuyor; doğrulama bunu zorunlu kontrol ediyor.
- **Gömülü ortak geometri yokluğu:** Kapanmış. Kök paket content script’lerinde `MANGA_TR_GEOMETRY_START` bulunuyor; doğrulama bunu zorunlu kontrol ediyor.
- **Gereksiz `storage` izni:** Kapanmış. Kök Chromium manifesti yalnız `activeTab`, `scripting`; Firefox manifesti yalnız `activeTab` izinlerini taşıyor. ZIP manifestleri de aynı içerikle eşleşiyor.
- **Yinelenen ZIP ağacı:** Kapanmış. ZIP’te yalnız `chromium/*` ve `firefox/*` hedefleri var.

## Açık sınırlar ve öneri

**Bulgu:** Bu raporda teslim zinciri ve dosya bütünlüğü doğrulanmıştır; fiziksel Chrome/Edge, Firefox desktop veya Firefox Android yükleme/etkileşim testi yapılmamıştır.

**Önem:** P2 — teslim zinciri açısından engelleyici değil; çalışma zamanı uyumluluğu açısından açık doğrulama.

**Öneri:** Gerçek tarayıcı testi ayrıca yapılarak popup, görsel seçimi, overlay konumlandırması, kapatma, resize/scroll ve tekrar kullanımdaki davranış doğrulanmalıdır.

## Sonuç

**Geçiş kararı: PASS.** Paketleme zinciri düzeltilmiş; `npm run verify:delivery` başarılı, paket kökleri güncel `dist` ile eşit, ZIP entry listesi tekil ve tüm ZIP hash’leri paketlerle eşleşiyor. Önceki P1 teslim bütünlüğü bulgusu kapanmıştır. Fiziksel tarayıcı testi kapsam dışı kalmıştır.

