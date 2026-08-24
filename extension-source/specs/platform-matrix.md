# Platform Matrisi

| Konu | Chromium | Firefox desktop | Firefox Android |
| --- | --- | --- | --- |
| Paket | Manifest V3 | Ayrı Firefox paketi | Ayrı Firefox paketi |
| Background | MV3 service worker | Event page uyumlu background | Event page; service worker varsayılmaz |
| Popup | `action.default_popup` | `browser_action.default_popup` | Add-ons menüsünde overlay popup |
| Seçim | `activeTab` + `scripting` | `activeTab` + tabs API | Gerçek cihazda doğrulanmalı |
| Ağ | Gelecekte dar HTTPS host izni | Gelecekte dar HTTPS host izni | Aynı, API uyumluluğu doğrulanmalı |
| Yayın | ZIP / Chrome Web Store | XPI / AMO | AMO beta sonrası |

## Resmî kaynaklardan doğrulanan kararlar

- Chrome Web Store mobil cihazdan uzantı kurulumunu desteklemez; ChromeOS uzantı kurulumunu destekler.
- Chrome content script'leri sayfanın same-origin kısıtına tabidir; extension context'ten çapraz kaynak erişimi host izni ister.
- Firefox Android, desktop WebExtension API'lerinin bir alt kümesini sunar. Mozilla'nın mevcut kılavuzu Android'de background service worker desteklenmediğini bildirir ve event page yaklaşımını önerir.

Kaynaklar: Chrome Web Store yardım sayfası, Chrome permissions/network requests dokümantasyonu, Mozilla Firefox Android geliştirme dokümantasyonu (2026-08-17'de erişildi).

## Uygulama kararı

Firefox paketi MV2/event-page uyumluluğuyla ayrı üretilir. Bu karar, Firefox Android fiziksel cihaz denemesinde tekrar doğrulanmadan mağaza desteği iddiasına dönüşmez.


