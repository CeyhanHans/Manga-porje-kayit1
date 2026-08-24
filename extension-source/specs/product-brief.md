# Ürün Özeti

## Amaç

Kullanıcı, açık bir manga veya görsel roman sayfasında kendi seçtiği tek görseldeki İngilizce metni Türkçe overlay olarak okuyabilmelidir.

## Hedef platformlar

| Kanal | Hedef |
| --- | --- |
| Chromium paketi | Chrome, Edge ve ChromeOS masaüstü |
| Firefox paketi | Firefox desktop ve Firefox Android |

Mobil Chrome ve iOS/iPadOS ilk sürüm kapsamı dışındadır. Kurumsal/okul cihazları mağaza yüklemesini engelleyebilir.

## Temel kullanıcı akışı

1. Kullanıcı uzantı popup'ından çeviriyi başlatır.
2. Aktif sayfada tek görseli seçer.
3. İlk geliştirme sürümü, doğrulama amacıyla sahte Türkçe region verisini overlay olarak gösterir.
4. Kullanıcı overlay'i kapatır veya yeni bir görsel seçer.

Gerçek ürün sürümünde region verisi merkezi HTTPS backend'den gelir. Uzantı geliştirici anahtarı taşımaz.

## Başarı tanımı

Seçim yalnız kullanıcının açık eylemiyle başlar; orijinal görsel değişmez; overlay yeniden boyutlandırma, kaydırma, lazy-load ve SPA değişimlerinde hedef görseli takip eder.


