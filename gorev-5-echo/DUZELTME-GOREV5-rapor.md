<!-- DUZELTME_GOREV5_BAŞLANGIÇ -->
# DUZELTME-GÖREV5-rapor.md — İlerleme ve Tamamlanma Mesajı: Erken "✓" Sorununu Düzeltme

**Tarih:** 2026-08-31
**Agent:** Echo (GLM / ZCode)
**Görev dokümanı:** `…\manga-overlay-duzeltme-agent-gorevleri.md` (GÖREV 5)
**Önerilen agent GPT-5.6 Luna idi; kote (mimar) görevi doğrudan Echo'ya atadı.**

## 0. Başlangıç durumu (kural 7)

| Alan | Değer |
|---|---|
| Çalışma kopyası | `C:\Users\user\.zcode\workspace\default\repos\Manga-porje-kayit1` |
| Branch | `main` |
| Başlangıç commit'i | `40c2fba` (GÖREV4 commit'i; working tree temiz) |

**Bağımlılık notu:** Görev 5 "Görev 4 PASS" bağımlıdır; GÖREV4 tarafımdan (40c2fba) tamamlandı.
Düzeltme Görev 1-2 hâlâ yapılmamış; mimar atamasıyla GÖREV5'e girildi.

## 1. Ne değişti ve neden

**Sorun:** Popup, işlem hâlâ sürerken `✓` gösteriyordu. `PROCESSING_COMPLETE` her görsel
sonunda gönderiliyordu; sağ alt sayaç ile popup birbiriyle çelişiyordu.

**Çözüm:**

1. **Benzersiz runId:** `startPageTranslation` her başlatmada `run-<base36-time>-<rand>`
   üretir. Tüm yaşam boyunca `currentRunId` modül düzeyinde sabit kalır.
2. **PROCESSING_PROGRESS her görselde bir kez:** `recordImageOutcome` içinde her
   nihai kategori atamada `finishWork` çağrılır; modül ilk önce progress mesajı yayar.
3. **PROCESSING_COMPLETE bir kez tetiklenir:** yalnızca **kuyruk boş + aktif iş = 0
   + done >= startedTotal** üç koşulu birlikte sağlandığında. `completionEmitted`
   bayrağı ikinci/yinelenen çağrıları yutar.
4. **Eski run mesajları yeni run'ı bozamaz:** `pumpQueue` `startWork`'ü `runId`
   uyuşmazlığında false döner; gecikmiş `finishWork` yanlış `runId` ile gelirse null
   döner. **Yeni run başlatıldığında `runState` ve `currentRunId` yenilenir**;
   eski state'e dışarıdan referans kalmaz.
5. **Overlay kapatılırsa run iptal:** `clearOverlays` `cancel` çağırır, sonra
   `finishCancelled` ile `cancelled=true` bir PROCESSING_COMPLETE atar. Popup
   bunu `iptal edildi` olarak gösterir, `✓` göstermez.
6. **Sıfır görsel durumu:** 0 manga görseli olan sayfada startPageTranslation çağrılırsa
   `startedTotal=0`, ilk `finishWork` (her hangi bir tetikleyici olmaz) → completion
   tetiklenmez. Popup `GET_RUN_LIFECYCLE` cevabında `runStartedTotal=0 && completed=true`
   ayrımıyla "Sayfada manga görseli bulunamadı" der, ✓ yok.
7. **Popup ✓'yı sadece gerçek tamamlanmada gösterir:** 3 koşul: (a) `completed=true`,
   (b) `cancelled=false`, (c) `runStartedTotal>0`. Bu üçü birlikte olmadan ✓ yok.

**Denklem (kod ve testte doğrulanır):**
`done = translated + skippedNoText + filteredNoise + untranslated + failedTechnical`
- `run-stats.doneTotal` zaten bu toplamı döner; `finishWork`'e geçilen `done` sayısı
  aynı kaynaktan gelir (kaynak tek nokta).
- Toplam denklem `tests/run-lifecycle.test.mjs:73` ile 36 görsel üzerinde sınandı.

## 2. Değişen dosyalar

| Dosya | Değişiklik |
|---|---|
| `src/shared/run-lifecycle.ts` | **YENİ** — saf yaşam döngüsü modülü (runId guard, startWork/cancel/finishWork/finishCancelled) |
| `src/content/content.ts` | runId + runState, pumpQueue startWork guard, recordImageOutcome finishWork, clearOverlays cancel+finishCancelled, GET_RUN_LIFECYCLE mesajı |
| `src/popup/popup.html` | `#complete` satırı (hide/ok/cancel sınıfları) |
| `src/popup/popup.ts` | `setComplete` + `applyLifecycle` — ✓ yalnızca gerçek tamamlanmada; iptal/işlem-sırasında/sıfır görselde farklı metin/sınıf |
| `scripts/build.mjs` | run-lifecycle modülü prelud olarak enjekte edilir (MangaTrRunStats ile aynı desen) |
| `tests/run-lifecycle.test.mjs` | **YENİ** — 6 zorunlu senaryo + 1 toplam denklem + 1 dist prelude testi = 8 test |

## 3. Çalıştırılan testler ve gerçek çıktılar

```
npm run dev
→ tsc --noEmit: hatasız
→ node --test: tests 29  pass 29  fail 0
   (12 mevcut + 3 GÖREV3 + 6 GÖREV4 + 8 GÖREV5)
→ verify-build: 13 envanter girdisi, hash'ler eşleşti
npm run package + npm run verify:delivery → PASS
```

**6 zorunlu senaryo:**
- **0 görsel** → 1 progress + 1 completion (cancelled=false)
- **1 başarılı görsel** → 1 progress + 1 completion
- **10 karışık sonuç** (5 çevrildi + 2 metin yok + 1 gürültü + 1 çevrilmedi + 1 hata) → 10 progress + 1 completion, doğru sayaçlarla
- **Kuyruk ortasında iptal** → cancel sonrası 1 progress + 1 completion (cancelled=true)
- **Eski run mesajı yeni run'a** → runId guard yanlış runId ile gelen finishWork'ü yutar; yeni run kendi tamamlamasını yapar
- **Son queued görsel + 2 aktif iş** → 1+2 aktifken completion atılmaz; son görsel de bitince tam 1 kez

## 4. Dokunulmayanlar (görev sınırı)

OCR kalite/raster ayarları, DeepL istek mantığı, overlay renk/font/geometri, background
kaynakları, manifestler, OCR runtime dosyaları, OCR worker scheduler.

## 5. Kalan riskler / sınırlar

- **Gerçek Chrome davranışı UNVERIFIED:** popup ✓/iptal/işlem-sırasında gizleme davranışı
  gerçek tarayıcıda denenmedi (Görev 11 kapsamı). 8 dist prelude testi modülün gömülü
  davranışını kanıtlıyor, gerçek mesaj kanalı (tabs.sendMessage) değil.
- `runId` her sekme için bağımsız; background'da saklanmaz. Birden çok sekme paralel
  çalışırsa her birinin kendi yaşamı ayrıdır (bilinçli tasarım).
- `active=0 && done>=startedTotal` koşulu **başlangıç toplamına** bakar; sonradan
  sayfaya eklenen görseller (GÖREV4'teki gibi) `done>=startedTotal`'ı hemen
  karşılayamaz — yine de kuyruğa alınır ve `active>0` olduğu sürece completion atılmaz
  (doğru davranış; yeni görsel gelirse kuyruk pompalanır).

## 6. YENİ BULGU (kural 19 — çözülmedi, kayda geçti)

- **popup `setInterval(2000)` polling maliyeti:** açık popup 2 sn'de bir sekmeye
  `GET_RUN_STATS + GET_RUN_LIFECYCLE` gönderiyor. 60 sn'de 30 × 2 = 60 round-trip
  sayfa başına. Görev 11 Chrome testinde kayda değer bulunmadı ama daha temizi
  content script'in `subscribe` ile push kanalı kurup `chrome.runtime.sendMessage`
  ile popup'a itmesi olurdu — kapsam dışı, GÖREV5 task sınırı dışı.
- `pumpQueue` startWork guard başarısızsa `break` ile döngüden çıkıyor; bu durumda
  aktif iş sayısı 3'e çıkmamışsa kuyruğun geri kalanı için `pumpQueue` tekrar
  çağrılmalı (processImage finally'inde zaten çağrılıyor; doğru).
<!-- DUZELTME_GOREV5_BİTİŞ -->
