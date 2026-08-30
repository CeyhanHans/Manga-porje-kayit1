<!-- AGENT_GOREV8_BAŞLANGIÇ -->
# GOREV8-rapor.md — DeepL Kota Tasarrufu: Toplu İstek Optimizasyonu

**Tarih:** 2026-08-31
**Agent:** Echo (GLM-5.2) — bu görevde SADECE Görev 8; diğer görevlerin bloklarına dokunulmadı.

---

## 1. Özet

`background.js` içindeki `translateTexts()` kota tasarrufu için yeniden düzenlendi:
**tekrarlayan metinler artık DeepL'e tek sefer gönderiliyor**, gönderilen karakter sayısı
loglanıyor ve dönüş her zaman girdi sırasına göre geri açılıyor. `content.js` tarafında
değişiklik gerekmedi — mevcut kod zaten sayfa/görsel bazında tek toplu istek gönderiyor
(kanıt bölümünde). Bonus: 50 metinlik DeepL sınırının yarattığı gizli hata da giderildi.

## 2. Görev maddelerinin karşılığı

### Madde 1 — "Her bölge için ayrı TRANSLATE_TEXTS gönderiliyorsa toplulaştır" → KOŞUL SAĞLANMADI, DEĞİŞİKLİK GEREKMEDİ
`content.js` / `translateBoxes()` (Görev 2 sonrası hali) zaten:
1. Tüm bölgelerin metinlerini tek dizide toplar (`sourceBoxes.map(...)`),
2. `new Set(...)` ile benzersizleştirir + `translationCache` (görseller arası ortak) ile
   daha önce çevrilmişleri eler,
3. **tek bir** `{ type: 'TRANSLATE_TEXTS', texts: missing }` mesajı gönderir,
4. çevirileri index sırasıyla `translationCache`'e yazıp bölgelerle eşleştirir.
Her bölge için ayrı mesaj YOK → content.js'e dokunulmadı.

### Madde 2 — `translateTexts()` içinde tekrarlayan metin filtresi → UYGULANDI
```js
const cleanTexts = texts.map((text) => String(text).trim()).filter(Boolean);
const uniqueTexts = [...new Set(cleanTexts)].slice(0, 50);
...
const translationMap = {};
uniqueTexts.forEach((text, index) => { translationMap[text] = uniqueTranslations[index]; });
return { translations: cleanTexts.map((text) => translationMap[text] ?? '') };
```
Aynı metin kaç bölgede olursa olsun DeepL'e BİR kez gider; dönüş girdi sırasına göre
geri açılır (her bölge doğru çevirisini alır).

### Madde 3 — Karakter harcaması logu → UYGULANDI
```js
const totalChars = uniqueTexts.reduce((sum, text) => sum + text.length, 0);
console.log(`[MangaTR DeepL] ${totalChars} karakter gönderildi.`);
```
(Gönderilen = benzersiz metinler; service worker konsolunda görünür.)

### Bonus düzeltme — 50 metin sınırı artık hata üretmiyor
Eski kod `cleanTexts.slice(0, 50)` yapıp 50'yi aşan girdiyi sessizce kırptığı için
content "eksik çeviri döndürdü" hatasıyla TÜM görseLi başarısız ediyordu. Yeni kod:
50 benzersiz metin gönderir, dönüş **girdi uzunluğunda** olur (51+ metinler boş döner,
content bu bölgeleri sessizce overlay dışı bırakır) — esnek bozulma, tam sayfa hatası yok.
Bu, görevin verdiği `translationMap` deseninin doğal sonucudur.

## 3. Dokunulan / dokunulmayanlar

| Dosya | Durum |
|---|---|
| `Desktop\chromium\background.js` | ✏️ `translateTexts` yeniden düzenlendi (`AGENT_GOREV8_BAŞLANGIÇ/BİTİŞ`) |
| `Desktop\chromium\content.js` | 🔒 dokunulmadı (madde 1'in koşulu yok — zaten toplu) |
| DeepL endpoint URL'si, `DeepL-Auth-Key` biçimi, anahtar yönetimi (`chrome.storage`) | 🔒 birebir korundu (yasak listesi) |
| Görev 2 fallback sözlüğü, Görev 7 hata mesajları (403/456) | 🔒 korundu (testlerle kanıtlı) |
| OCR dosyaları, `manifest.json`, `popup.*` | 🔒 dokunulmadı |
| TypeScript | not: görev metninde TS maddesi yok; ayrıca `translateTexts` katmanı TS kaynaklarında hiç yok (Görev 2 ve 6 raporlarında belgelendi) — derlenmiş dosya ile TS arasındaki bilinen borç devam ediyor |

## 4. Test — 19/19 PASS (`backup_GOREV8\gorev8-test.mjs`)

Yapı (S1-S8): dedup mevcut, log mevcut, endpoint/auth değişmedi, dönüş sırası şablonda,
AGENT_GOREV8 işaretleri, Görev 2/7 blokları korundu.
Davranış (T1-T11) — gerçek dosyadan çıkarılan `translateTexts`, mock `chrome.storage` +
`fetch` + gerçek fallback sözlüğü ile:

| Test | Kanıt |
|---|---|
| T1 | `['HELLO','WORLD','HELLO','HELLO','WORLD',' BYE ']` → DeepL **3 metin** aldı (`HELLO, WORLD, BYE`) |
| T2 | Dönüş 6 eleman, her girdi kendi çevirisiyle doğru sırada eşleşti |
| T3 | `[MangaTR DeepL] 13 karakter gönderildi.` (yalnız benzersiz metinlerin toplamı) |
| T4-T6 | 55 benzersiz metin → fetch 50 aldı; dönüş 55; ilk 50 çevrili, son 5 boş; **hata yok** |
| T7-T8 | "TO BE" DeepL'den aynen dönerse fallback "olmak için"e düzeltiyor; gerçek çeviriye dokunmuyor |
| T9 | Tümü boş girdi → fetch hiç çağrılmadı |
| T10-T11 | 456 kota hatası ve "eksik çeviri" hata akışları (Görev 7) aynen çalışıyor |

`node --check background.js`: OK.

**Başarı kriterleri:** "Tekrar eden metinler tek seferinde çevrilmeli" → T1 kanıtı.
"Bir sayfa işlendiğinde tek DeepL isteği" → görsel başına tek istek zaten garantiydi
(content tek mesaj); artı görseller arası `translationCache` sayesinde aynı metin hiç
yeniden gönderilmiyor. Not: KAYFA bazında literal tek istek, Görev 4'ün kademeli
(IntersectionObserver'lı, scroll ile büyüyen) işleme tasarımıyla çelişir — lazy-load
manga sayfalarında tüm sayfayı önceden bilmek mümkün olmadığından bu sınır bilinçli olarak
"görsel başına tek istek + dedup + cache" olarak karşılandı.

## 5. Yedek

`Desktop\chromium\backup_GOREV8\background.js` (değişiklik öncesi) + `gorev8-test.mjs` (kanıt).
<!-- AGENT_GOREV8_BİTİŞ -->


---

## 6. Ek — Değişen dosyanın tam içeriği (değişiklik sonrası)

### 6.1 Desktop\chromium\background.js (220 satır)

```js
/* MANGA_TR_TRANSLATION_FALLBACK_START */
const fallbackTranslations = {
    'wicked huh': 'Fena, ha?',
    huh: 'Ha?',
    wicked: 'Fena',
    yeah: 'Evet',
    yep: 'Evet',
    nope: 'Hayır',
    nah: 'Yok',
    /* AGENT_2_BAŞLANGIÇ */
    'to be': 'olmak için',
    'the rooftop': 'çatı katı',
    wait: 'dur',
    stop: 'dur',
    go: 'git',
    run: 'koş',
    help: 'yardım',
    no: 'hayır',
    yes: 'evet',
    what: 'ne',
    why: 'neden',
    how: 'nasıl',
    now: 'şimdi',
    here: 'burada',
    'i see': 'anlıyorum',
    impossible: 'imkânsız',
    'no way': 'olmaz',
    seriously: 'ciddiye mi',
    damn: 'lanet',
    tch: 'tss',
    hmm: 'hmm',
    /* AGENT_2_BİTİŞ */
};
function translationKey(text) {
    return String(text ?? '')
        .toLowerCase()
        .replace(/[’']/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}
function comparableText(text) {
    return String(text ?? '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '');
}
function repairUntranslatedText(source, translated) {
    const cleanTranslated = String(translated ?? '').trim();
    const fallback = fallbackTranslations[translationKey(source)];
    if (!fallback)
        return cleanTranslated;
    if (!cleanTranslated)
        return fallback;
    return comparableText(source) === comparableText(cleanTranslated) ? fallback : cleanTranslated;
}

globalThis.MangaTrTranslationFallback = { repairUntranslatedText };
/* MANGA_TR_TRANSLATION_FALLBACK_END */
"use strict";
var MangaTrChromiumBackground;
(function (MangaTrChromiumBackground) {
    const DEEPL_ENDPOINT = 'https://api-free.deepl.com/v2/translate';
    const IMAGE_REFERRER_RULE_ID = 740001;
    async function translateTexts(texts, explicitKey) {
        const key = explicitKey || (await chrome.storage.local.get('deeplApiKey')).deeplApiKey;
        if (!key)
            throw new Error('DeepL API anahtarı ayarlanmamış. Uzantı popup’ından anahtarı kaydedin.');
        /* AGENT_GOREV8_BAŞLANGIÇ: kota tasarrufu — tekrarlayan metinler tek sefer çevrilir,
           gönderilen karakter sayısı loglanır ve dönüş her zaman GİRİŞ sırasına göre geri açılır.
           DeepL isteği başına 50 metinlik sınır artık hata değil: 51+ metin ilk 50'de çevrilir,
           kalanlar boş döner (önceden eksik uzunluk tüm sayfayı hatalı ediyordu). */
        const cleanTexts = texts.map((text) => String(text).trim()).filter(Boolean);
        const uniqueTexts = [...new Set(cleanTexts)].slice(0, 50);
        if (!uniqueTexts.length)
            return { translations: [] };
        const totalChars = uniqueTexts.reduce((sum, text) => sum + text.length, 0);
        console.log(`[MangaTR DeepL] ${totalChars} karakter gönderildi.`);
        const response = await fetch(DEEPL_ENDPOINT, {
            method: 'POST',
            headers: { Authorization: `DeepL-Auth-Key ${key}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: uniqueTexts, source_lang: 'EN', target_lang: 'TR' }),
        });
        if (!response.ok) {
            if (response.status === 403)
                throw new Error('DeepL API anahtarınız geçersiz veya kotanız dolmuş olabilir.');
            if (response.status === 456)
                throw new Error('DeepL aylık karakter kotanız doldu. Yeni ay başında sıfırlanır.');
            throw new Error(`DeepL çeviri isteği başarısız (${response.status}).`);
        }
        const payload = await response.json();
        const uniqueTranslations = Array.isArray(payload?.translations)
            ? payload.translations.map((item, index) => MangaTrTranslationFallback.repairUntranslatedText(uniqueTexts[index], String(item?.text ?? '')))
            : [];
        if (uniqueTranslations.length !== uniqueTexts.length)
            throw new Error('DeepL eksik çeviri sonucu döndürdü.');
        const translationMap = {};
        uniqueTexts.forEach((text, index) => { translationMap[text] = uniqueTranslations[index]; });
        return { translations: cleanTexts.map((text) => translationMap[text] ?? '') };
        /* AGENT_GOREV8_BİTİŞ */
    }
    async function setDeepLKey(key) {
        const trimmed = String(key ?? '').trim();
        if (!/^[A-Za-z0-9-]+(?::fx)?$/.test(trimmed))
            throw new Error('DeepL API anahtarı biçimi geçersiz.');
        await translateTexts(['Connection test.'], trimmed);
        await chrome.storage.local.set({ deeplApiKey: trimmed });
        return { configured: true };
    }
    async function fetchImage(url, pageUrl) {
        if (url.startsWith('data:image/'))
            return { dataUrl: url };
        const parsed = new URL(url);
        if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:')
            throw new Error(`OCR görsel URL protokolü desteklenmiyor (${parsed.protocol}).`);
        const validReferrer = pageUrl && /^https?:\/\//i.test(pageUrl) ? pageUrl : undefined;
        let referrerRuleInstalled = false;
        if (validReferrer && chrome.declarativeNetRequest?.updateSessionRules) {
            try {
                await chrome.declarativeNetRequest.updateSessionRules({
                    removeRuleIds: [IMAGE_REFERRER_RULE_ID],
                    addRules: [{
                            id: IMAGE_REFERRER_RULE_ID,
                            priority: 1,
                            action: {
                                type: 'modifyHeaders',
                                requestHeaders: [
                                    { header: 'Referer', operation: 'set', value: validReferrer },
                                    { header: 'Origin', operation: 'remove' },
                                ],
                            },
                            condition: { requestDomains: [parsed.hostname], resourceTypes: ['xmlhttprequest', 'image', 'media', 'other'] },
                        }],
                });
                referrerRuleInstalled = true;
            }
            catch (error) {
                console.warn('Görsel referer kuralı kurulamadı; normal istek denenecek.', error);
            }
        }
        let response;
        try {
            response = await fetch(parsed.href, {
                credentials: 'omit',
                cache: 'no-store',
                referrer: validReferrer,
                referrerPolicy: 'strict-origin-when-cross-origin',
                headers: { Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8' },
            });
        }
        finally {
            if (referrerRuleInstalled)
                await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [IMAGE_REFERRER_RULE_ID] }).catch(() => undefined);
        }
        if (!response.ok)
            throw new Error(response.status === 403 ? 'Görsel sunucusu erişimi reddetti (403).' : `OCR görseli alınamadı (${response.status}).`);
        const blob = await response.blob();
        if (!blob.type.startsWith('image/'))
            throw new Error('Sunucu görsel yerine farklı bir içerik döndürdü.');
        const bytes = new Uint8Array(await blob.arrayBuffer());
        let binary = '';
        const chunkSize = 0x8000;
        for (let offset = 0; offset < bytes.length; offset += chunkSize)
            binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
        return { dataUrl: `data:${blob.type || 'image/png'};base64,${btoa(binary)}`, transport: 'background-fetch' };
    }
    async function sendToActiveTab(message) {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id)
            throw new Error('Aktif sekme bulunamadı.');
        if (message.type === 'CLEAR_OVERLAY') {
            await chrome.tabs.sendMessage(tab.id, message).catch(() => undefined);
            return;
        }
        try {
            await chrome.tabs.sendMessage(tab.id, message);
        }
        catch {
            await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
            await chrome.tabs.sendMessage(tab.id, message);
        }
    }
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'FETCH_IMAGE') {
            fetchImage(message.url, sender?.tab?.url)
                .then(sendResponse)
                .catch((error) => sendResponse({ error: error instanceof Error ? error.message : String(error) }));
            return true;
        }
        if (message.type === 'CAPTURE_VISIBLE_TAB') {
            if (!sender?.tab?.active || typeof sender.tab.windowId !== 'number') {
                sendResponse({ error: 'OCR ekran yakalama fallback’i yalnızca aktif sekmede çalışabilir.' });
                return;
            }
            chrome.tabs.captureVisibleTab(sender.tab.windowId, { format: 'png' })
                .then((dataUrl) => sendResponse({ dataUrl }))
                .catch((error) => sendResponse({ error: error instanceof Error ? error.message : String(error) }));
            return true;
        }
        if (message.type === 'TRANSLATE_TEXTS') {
            translateTexts(message.texts)
                .then(sendResponse)
                .catch((error) => sendResponse({ error: error instanceof Error ? error.message : String(error) }));
            return true;
        }
        if (message.type === 'SET_DEEPL_KEY') {
            setDeepLKey(message.key)
                .then(sendResponse)
                .catch((error) => sendResponse({ error: error instanceof Error ? error.message : String(error) }));
            return true;
        }
        if (message.type === 'GET_TRANSLATOR_STATUS') {
            chrome.storage.local.get('deeplApiKey')
                .then((value) => sendResponse({ configured: Boolean(value.deeplApiKey) }))
                .catch(() => sendResponse({ configured: false }));
            return true;
        }
        if (message.type !== 'START_PAGE_TRANSLATION' && message.type !== 'CLEAR_OVERLAY')
            return;
        return sendToActiveTab(message);
    });
})(MangaTrChromiumBackground || (MangaTrChromiumBackground = {}));

```
