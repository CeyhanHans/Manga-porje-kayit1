# Faz 3 Planı ve Maliyet Kararları

## Plan

1. Lisansı ve sürümü sabitlenmiş iki OCR+çeviri adayını seç.
2. Kullanım izni kayıtlı iki test görseliyle sandbox/spike yap.
3. Her aday için gerçek response'ta `regions`, polygon ve confidence alanlarını doğrula.
4. Görüntü başına maliyet, gecikme, başarısızlık oranı ve saklama davranışını kaydet.
5. Sonuçlar onaylanmadan ürün backend'ine kalıcı bağımlılık ekleme.

## Açık maliyet kararları

- Sağlayıcı, model, fiyat katmanı ve günlük ücretsiz kota henüz seçilmedi.
- Bu nedenle gerçek spike, API anahtarı oluşturma veya ücretli servis açma yapılmadı.
- Ürün geliştirici anahtarı olmadan dağıtılamaz; seçilen sağlayıcının lisansı (özellikle copyleft/GPL bileşenler) yayından önce incelenmelidir.

## Kullanıcı onayı gereken sonraki işlem

İki adaydan hangisinin deneneceği, varsa ücretsiz sandbox hesabının açılması ve API anahtarının hangi sağlayıcıda oluşturulacağı. Bu onay olmadan gerçek OCR/çeviri isteği veya sunucu yayını yapılmayacaktır.


