# MVP Kapsamı

## Dahil

- Tek görselin kullanıcıyla seçilmesi ve çerçevelenmesi.
- Chrome MV3 ve Firefox için ayrı paket hedefleri.
- Türkçe metin bölgelerini gösteren açılıp kapanabilir overlay.
- Sürümü olan region DTO'su ve yerel sahte yanıt.
- Yerel demo sırasında kullanıcının seçimi olmadan sayfa taramama veya veri göndermeme.

## Hariç

- Toplu bölüm/sayfa çevirisi, video, oyun, inpainting veya İngilizce metni silme.
- Gerçek OCR/çeviri çağrısı, API anahtarı, kullanıcı hesabı, ödeme ve telemetri.
- Kalıcı cache; bu sürümde cache kapalıdır.
- Mobil Chrome, iOS/iPadOS ve her site için kusursuz otomasyon.

## Kabul eşiği

Bir test görselinde seçim, çerçeve ve sahte region overlay Chrome masaüstünde açılıp kapanmalıdır. Firefox Android gerçek cihaz testi, merkezi backend eklenmeden önce ayrı kabul kaydı gerektirir.


