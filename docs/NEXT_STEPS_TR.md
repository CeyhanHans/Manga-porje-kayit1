# Devam Planı

## Bir sonraki çalışma için ilk görev

**Amaç:** 0.5.3 kaynak snapshot'ını yeniden üretilebilir hâle getir ve gerçek Chromium kabul testini yap.

**Kapsam:** Yeni özellik, inpainting, mağaza yayını veya ücretli servis ekleme yok.

1. `extension-source/` içeriğini temiz ortamda kur.
2. `npm run check`, `npm test`, `npm run package`, `npm run verify:delivery` çalıştır.
3. Her hatayı kaynak veya package scriptinde minimal biçimde düzelt; derlenmiş çıktıyı elle düzenleme.
4. Paket kökleri, ZIP ve `dist` dosyalarının aynı sürüm olduğuna dair hash/manifest doğrulaması ekle.
5. Lisanslı gerçek manga görselinde Chromium uzantısını yükle ve aşağıdaki kabul tablosunu doldur.

| Kabul ölçütü | Sonuç |
|---|---|
| OCR okunabilir İngilizce metin üretti mi? | Bekliyor |
| DeepL doğru Türkçe sonuç verdi mi? | Bekliyor |
| Kutular gereksiz büyük mü? | Bekliyor |
| Font/satır aralığı/letter-spacing okunabilir mi? | Bekliyor |
| Görsel kaydırma/zoom/resize sonrası konum doğru mu? | Bekliyor |
| Hata/iptal akışı anlaşılır mı? | Bekliyor |

## Sonraki sıra

1. Chromium gerçek kabul testi PASS.
2. Firefox masaüstü testi.
3. Firefox Android fiziksel cihaz testi.
4. Destek kitini gözlem modunda bağlama ve fixture/benchmark altyapısı.
5. Merkezi backend mi, kullanıcı kontrollü local anahtar mı: güvenlik ve maliyet kararı.
6. Cache/gizlilik/SBOM/mağaza materyalleri.
7. Unlisted/beta, ardından kullanıcı onaylı genel yayın.

## Geçiş kapısı

Gerçek cihaz ve görsel kalite kanıtı olmadan sonraki aşama "tamamlandı" veya "mağazaya hazır" olarak etiketlenmez.

