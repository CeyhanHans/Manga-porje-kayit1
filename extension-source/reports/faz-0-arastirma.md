# Faz 0 Araştırma ve Geçiş Kaydı

## Doğrulanan bulgular

- Chrome Web Store uzantıları mobil Chrome'a kurulamaz; ChromeOS uzantı kurulumunu destekler.
- Chrome'da uzak bir backend'e erişim extension context'te ve host izniyle yapılmalıdır; content script aynı-origin kısıtındadır.
- Firefox Android API'leri desktop'tan farklıdır. Mozilla, Android'de background service worker desteği olmadığını ve event page yaklaşımını belirtir.

## Backend maliyet/kota varsayımları

- Beta için varsayılan: kullanıcı başına küçük günlük kota; kota değeri sağlayıcı ve gerçek görüntü ölçümünden sonra belirlenir.
- İstemci hiçbir sağlayıcı anahtarı taşımaz; maliyetin kontrolü yalnız merkezi backend'de yapılır.
- Maksimum görüntü boyutu, piksel sayısı, eşzamanlı iş sayısı ve job TTL sağlayıcı spike'ından önce kesinleştirilmez.

## Açık sorular

1. Firefox Android minimum sürümü ve gerçek test cihazı.
2. OCR/çeviri adayının lisansı, region/polygon/confidence çıktısı ve gerçek maliyeti.
3. Test görsellerinin kullanım izinleri ve 30 görsellik benchmark seti.
4. Backend için kimlik doğrulama ve ücretsiz beta kotasının ürün kararı.

## Geçiş kararı

Dokümantasyon ve iki hedefli paket tasarımı hazırdır. Fiziksel Firefox Android POC'si bu bilgisayarda cihaz bağlı olmadığı için henüz çalıştırılmamıştır; bu, mağaza/beta yayını için engeldir ancak yerel Faz 1–2 geliştirmesini engellemez.


