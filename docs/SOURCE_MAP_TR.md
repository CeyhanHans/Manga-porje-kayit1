# Kaynak ve Kanıt Haritası

## Ana extension kaynak snapshot'ı

Orijinal yerel konum: `C:\\Users\\user\\Documents\\Codex\\2026-08-17\\bu-raporu-proje-s-zle-mesi-2`

Bu repoda aynı kaynaklar `extension-source/` altında, bağımlılıklar ve paketlenmiş OCR binary'leri hariç tutulmuş biçimde saklanır.

| Alan | Önemli dosyalar |
|---|---|
| Content/overlay | `src/content/content.ts` |
| OCR | `src/ocr/ocr.ts`, `src/ocr/ocr-frame.ts`, `src/shared/ocr-cleanup.ts` |
| Chromium mesaj/DeepL | `src/background/background.chromium.ts` |
| Firefox mesaj/DeepL | `src/background/background.firefox.ts` |
| Manifestler | `src/manifest/manifest.chromium.json`, `src/manifest/manifest.firefox.json` |
| Build/paket | `scripts/build.mjs`, `scripts/package.mjs`, `scripts/verify-delivery.mjs` |
| Test | `tests/*.test.mjs` |
| Ürün/tehdit belgeleri | `specs/*.md`, `reports/*.md` |

## Artefakt konumları (yerel, binary dahil değildir)

- Chromium yüklenebilir paket: `C:\\Users\\user\\Desktop\\chromium`
- Firefox 0.5.3 yayın artefaktları: `C:\\Users\\user\\Documents\\Codex\\2026-08-17\\ocr-hata-ve-z-m-raporu\\outputs`
- Eski birleşik OCR demo paketi: `...\\bu-raporu-proje-s-zle-mesi-2\\outputs\\manga-turkce-overlay-demo-paketleri-guncel.zip`

## Geçmiş kaynakların güven derecesi

| Kaynak | Güven |
|---|---|
| Yerel 0.5.3 TypeScript kaynakları ve manifestler | Korunacak kaynak snapshot; yeniden build/test gerekli |
| Paket/ZIP teftiş raporları | Geçmiş teslim kanıtı; 0.5.3'e doğrudan genellenmez |
| `CeyhanHans/Projem-manga` | Testli bağımsız destek çekirdeği; ana extension değildir |
| Manuel düzenlenmiş derlenmiş `content.js` varyantları | Deneysel referans; kaynak TypeScript'e taşınmadıkça kalıcı değildir |

## Dış kaynaklar

- Mevcut destek kiti: `https://github.com/CeyhanHans/Projem-manga`
- DeepL Free endpoint: `https://api-free.deepl.com/v2/translate`

API anahtarları asla bu repoya, commit mesajına, fixture'a veya loga eklenmez.

