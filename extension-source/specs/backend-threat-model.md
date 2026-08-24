# Backend Tehdit Modeli — Faz 3 Taslağı

| Tehdit | Kontrol |
| --- | --- |
| Anahtarın istemciye sızması | Sağlayıcı anahtarları yalnız sunucuda; git/uzantı taraması |
| SSRF ile keyfi URL indirme | URL değil doğrulanmış bayt kabulü |
| Görüntü bombası / kaynak tüketimi | MIME, byte, piksel, decode timeout ve iş kuyruğu sınırı |
| Kota kötüye kullanımı | Kısa ömürlü auth, kullanıcı/cihaz kotası, rate limit |
| Başkasının sonucuna erişim | Job sahipliği, kullanıcıya bağlı kısa ömürlü sonuç URL'si |
| Tekrar gönderim | `Idempotency-Key`, TTL ve atomik kayıt |
| Gizli veri logu | Ham görüntü/metin loglama varsayılan kapalı; erişim denetimi |
| Sağlayıcı/veri aktarımı | Gizlilik beyanı, DPA/lisans incelemesi, saklama politikası |


