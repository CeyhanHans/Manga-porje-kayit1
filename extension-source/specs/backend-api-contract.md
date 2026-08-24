# Merkezi Backend API Sözleşmesi — Taslak v1

Bu belge uygulama planıdır; endpoint veya sunucu çalışır durumda değildir.

## `POST /v1/translate-image`

### İstek

- `Authorization: Bearer <kısa ömürlü kullanıcı/cihaz erişim belirteci>`
- `Idempotency-Key: <UUID>`
- `Content-Type: multipart/form-data`
- `image`: yalnız doğrulanmış görüntü baytı; URL kabul edilmez.
- `client_request_id`: UUID.

### Başarı (200)

```json
{
  "schema_version": "2026-08-17.v1",
  "request_id": "uuid",
  "image": { "width": 1000, "height": 1400 },
  "regions": [{ "id": "r1", "polygon": [[1,2],[3,4],[5,6]], "text": "Türkçe", "confidence": 0.98 }],
  "usage": { "remaining_today": 4 }
}
```

### Hata şeması

`{ "error": { "code": "IMAGE_TOO_LARGE", "message": "...", "retryable": false, "request_id": "uuid" } }`

Kodlar: `UNAUTHORIZED`, `QUOTA_EXCEEDED`, `UNSUPPORTED_MEDIA_TYPE`, `IMAGE_TOO_LARGE`, `PIXEL_LIMIT_EXCEEDED`, `RATE_LIMITED`, `PROCESSING_TIMEOUT`, `UPSTREAM_UNAVAILABLE`, `CANCELLED`.

## Zorunlu uygulama sınırları

- HTTPS, auth, kullanıcı başına kota/rate limit, maksimum boyut/piksel, timeout.
- İş sahibine bağlı kısa TTL; idempotent tekrarlar aynı sonucu döndürür.
- Sonuçlar veya hata ayıklama görüntüleri varsayılan olarak kalıcı saklanmaz.


