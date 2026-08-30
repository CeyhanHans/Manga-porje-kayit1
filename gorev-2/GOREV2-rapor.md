# GÖREV2-rapor.md — Kısmi Çeviri: Kısa Metinler Çevrilmiyor

**Tarih:** 2026-08-30
**Agent:** Echo (GLM-5.2)
**Görev:** "TO BE" gibi kısa ifadelerin çevrilmemesi + çok satırlı balonlarda ikinci satırın İngilizce kalması

---

## 1. Teşhis — sorunun gerçek kökü

### Kök neden 1: OCR balon satırlarını ayrı kutular olarak verebiliyor
`ocr-frame.js` (satır ~1550, **okundu, değiştirilmedi**): aynı balondaki satırlar
`cleanAndGroupOcrLines` ile gruplanıyor ve metinler `join(" ")` ile birleşiyor. Ancak
gruplama eşiğini kaçıran satırlar **ayrı box** olarak content.js'e düşüyor. Sonuç:
"I FINALLY FOUND" çevriliyor, altındaki kısa "TO BE..." ayrı kutuda DeepL'e gidiyor ve
kısa metinlerde DeepL bazen çeviri yapmayıp metni aynen döndürüyor → İngilizce kalıyor.

### Kök neden 2: Satır yapısı çeviri sonrası korunmuyordu
`content.js` içindeki `wrapText` metni `split(/\s+/)` ile bölüyor — `\n` dahil tüm
boşluklar teke iniyor, çok satırlı yap overlay'de kayboluyordu.

### Kök neden 3: Fallback sözlüğü çok küçüktü
`background.js` içindeki `repairUntranslatedText` mekanizması sağlamdı ama sözlükte
7 giriş vardı; "to be", "the rooftop" gibi ifadeler yoktu. DeepL çevirmeyip aynen
döndürdüğünde düzeltilecek sözlük girişi bulunamıyordu.

## 2. Görev maddesi 1'in kontrol sonucu — KISA METİN FİLTRESİ

`background.js` → `translateTexts()` incelendi:
```js
const cleanTexts = texts.map((text) => String(text).trim()).filter(Boolean).slice(0, 50);
```
**Kısa metin filtresi YOK.** Sadece boş metinler eleniyor ve 50 metinlik güvenlik sınırı
var. 1-2 kelimeli metinler DeepL'e zaten gönderiliyor. **Kaldırılacak filtre bulunmadığı
için bu adımda değişiklik yapılmadı** (talimat: "eğer düşüyorsa kaldır" — düşmüyor).
Problem filtrenin varlığı değil, DeepL'in kısa metinleri aynen geri döndürmesiydi; çözüm
fallback sözlüğü (madde 3) ve bağlam birleştirme (madde 2) ile sağlandı.

## 3. Yapılan değişiklikler

### 3.1 `Desktop\chromium\background.js`
- `fallbackTranslations` sözlüğüne görev tanımındaki **20 yeni giriş** eklendi
  (`AGENT_2_BAŞLANGIÇ/BİTİŞ` işaretli): to be, the rooftop, wait, stop, go, run, help,
  no, yes, what, why, how, now, here, i see, impossible, no way, seriously, damn, tch, hmm.
- Mevcut 7 giriş (`wicked huh`, `huh`, ...) **korundu**.
- `translationKey()` küçük harf + noktalama temizliği yaptığından "THE ROOFTOP..." gibi
  büyük harf/noktalı formlar da sözlüğe otomatik eşleşiyor (test E3 ile kanıtlandı).

### 3.2 `Desktop\chromium\content.js`
- **`mergeAdjacentBoxes(boxes)` eklendi:** dikeyde bitişik (boşluk ≤ 1.6 satır yüksekliği,
  hafif örtüşmeye ±0.4 tolerans) VE yatayda ≥ %45 örtüşen kutuları tek balonda birleştirir.
  Metinler `\n` ile bağlanır, `lineCount` toplanır, bbox ve confidence birleştirilir.
  Uzak/farklı balonlar kesinlikle birleşmez (test B1/B2). Zincirleme çalışır: 3+ satırlı
  balonlar da tek kutuda toplanır (test C1/C2).
- **`translateBoxes()` güncellendi:** çeviriye göndermeden önce `mergeAdjacentBoxes`
  uygular → aynı balonun tüm satırları TEK metin halinde `\n` ile DeepL'e gider (bağlam
  korunur, kısa ikinci satır çevrilir), çeviri gelince `\n` yapısı korunur.
- **`wrapTextWithBreaks()` eklendi (TEXT_FIT bloğu):** metni önce `\n` segmentlerine
  böler, her segmenti ayrı sığdırır → çevirideki her satır overlay'de **ayrı satır** olur
  (görev maddesi 2'nin "çeviri gelince \n'den böl" kısmı). `\n` yoksa eski davranışla birebir.

### 3.3 TypeScript kaynağı — `extension-source/src/content/content.ts`
**Dikkat:** TS kaynağının 3 kopyası bulundu; en günceli (2026-08-30 23:02, Codex review
kopyası) güncellendi. Diğer kopyalara dokunulmadı. Aynı değişiklikler TS sözdizimiyle
uygulandı: `mergeAdjacentBoxes` (tipli), `translateBoxes` merge entegrasyonu, `fitText`
içinde segment-sonu zorunlu satır kırma (`\n` işaretli kelime yaklaşımı).

### 3.4 TypeScript `background.ts` — DOKUNULMADI, NEDENİ RAPOR EDİLİYOR
`background.ts` derlenmiş `background.js`'ten **çok geride**: içinde `translateTexts`,
`fallbackTranslations`, DeepL katmanı, `FETCH_IMAGE`, `CAPTURE_VISIBLE_TAB` **hiç yok** —
sadece eski START_SELECTION/CLEAR_OVERLAY yönlendirmesi var. Görev 2 kapsamında bu
katmanı TS'e taşımak hem görev sınırlarını aşar hem Görev 6 (build zinciri) ve Görev 8
(DeepL optimizasyonu) ile çakışır. Derlenmiş dosya ile TS arasındaki bu farkın giderilmesi
Görev 6'ya bırakılmalıdır. **Çalışan uzantı (Desktop\chromium) eksiksiz düzeltildi.**

## 4. Dokunulan / dokunulmayan dosyalar

| Dosya | Durum |
|---|---|
| `Desktop\chromium\background.js` | ✏️ fallback sözlüğü +20 giriş |
| `Desktop\chromium\content.js` | ✏️ mergeAdjacentBoxes + translateBoxes + wrapTextWithBreaks |
| `...\Codex\2026-08-30\...\content.ts` | ✏️ aynı değişiklikler TS'te |
| `ocr-core\`, `ocr-lang\`, `ocr-worker.min.js` | 🔒 dokunulmadı |
| `ocr.js`, `ocr-frame.js` | 🔒 dokunulmadı (yalnızca okunup teşhis için) |
| `manifest.json`, `popup.*` | 🔒 dokunulmadı |
| Yedekler | `Desktop\chromium\backup_2\` (değişiklik öncesi 3 dosya + test scripti) |

## 5. Test — 17/17 PASS

**Yöntem:** `node --check` sözdizimi + gerçek dosyalardan çıkarılan fonksiyonlarla
davranış testi (`backup_2\gorev2-test.js`, kanıt çıktısı rapor sonunda).

| Test | Kanıt |
|---|---|
| A1-A4: aynı-balon satırları birleşir | PASS — metin `\n` ile, lineCount=2, bbox birleşik |
| B1-B2: uzak / örtüşmeyen balonlar birleşmez | PASS — 2 ayrı kutu korunur |
| C1-C2: 3 satırlı balon zincirleme (sırasız girdiyle) | PASS — "THE\nROOFTOP\nIS HIGH" |
| D1-D3: `\n` segmentleri overlay'de ayrı satır | PASS — dar alanda segment sonu satır sınırı |
| E1-E2: "TO BE" → "olmak için" (boş ve aynen dönen çeviri) | PASS |
| E3: "THE ROOFTOP..." → "çatı katı" (büyük harf + nokta) | PASS |
| E4-E5: gerçek çeviri ve bilinmeyen kelimeye dokunulmaz | PASS |
| E6: eski 7 sözlük girişi bozulmaz | PASS |
| `node --check content.js` / `background.js` | OK |

**Başarı kriterleri karşılığı:**
- "TO BE" tek başına balonlarda çevrilmeli → fallback (E1/E2) + bağlam birleştirme sağlar.
- "THE ROOFTOP..." ikinci satır olarak çevrilmeli → merge + `\n` korumalı gönderim (A/C/D).

**Gerçek tarayıcı kanıtı:** Görev 2 kapsamında uzantı Chrome'a yüklenip gerçek manga
sayfasında denenmedi — bu, Görev 10 (regresyon testi) kapsamındadır. Kod düzeyindeki
kanıt 17/17 testtir.

## 6. Riskler ve notlar

- **Görev 1 işareti çakışması:** `content.js`'te `AGENT_GOREV1_BAŞLANGIÇ/BİTİŞ` işaretleri
  tüm dosyayı kapsayacak biçimde duruyor (satır 1 → 548 arası). Benim değişikliklerim
  kendi `AGENT_2_BAŞLANGIÇ/BİTİŞ` bloklarıyla ayrı işaretlendi; Görev 1'in koduna
  (`filterEnglishOcrBoxes`, `processImage` içi) dokunulmadı.
- **Birleştirme eşikleri** muhafazakâr seçildi (≤1.6 satır yüksekliği dikey boşluk,
  ≥%45 yatay örtüşme) — yan balonları yanlış birleştirme riski düşük; gerçek sayfa
  testinde eşik ayarı gerekebilir.
- **translationCache** anahtarları artık `\n`'li birleşik metinler; aynı oturumda
  eski önbellekle çakışmaz (uzantı reload'da sıfırlanır).


---

## 7. Ek — Değişen dosyaların tam içeriği (değişiklik sonrası)

### 7.1 Desktop\chromium\background.js (205 satır)

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
        const cleanTexts = texts.map((text) => String(text).trim()).filter(Boolean).slice(0, 50);
        if (!cleanTexts.length)
            return { translations: [] };
        const response = await fetch(DEEPL_ENDPOINT, {
            method: 'POST',
            headers: { Authorization: `DeepL-Auth-Key ${key}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: cleanTexts, source_lang: 'EN', target_lang: 'TR' }),
        });
        if (!response.ok)
            throw new Error(`DeepL çeviri isteği başarısız (${response.status}).`);
        const payload = await response.json();
        const translations = Array.isArray(payload?.translations)
            ? payload.translations.map((item, index) => MangaTrTranslationFallback.repairUntranslatedText(cleanTexts[index], String(item?.text ?? '')))
            : [];
        if (translations.length !== cleanTexts.length)
            throw new Error('DeepL eksik çeviri sonucu döndürdü.');
        return { translations };
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

### 7.2 Desktop\chromium\content.js (682 satır)

```js
/* AGENT_GOREV1_BAŞLANGIÇ */
/* MANGA_TR_GEOMETRY_START */
function contentRect(box, source, fit) {
    if (!source.width || !source.height)
        return box;
    const containScale = Math.min(box.width / source.width, box.height / source.height);
    const coverScale = Math.max(box.width / source.width, box.height / source.height);
    const scale = fit === 'cover' ? coverScale : fit === 'none' ? 1 : fit === 'fill' ? undefined : fit === 'scale-down' ? Math.min(1, containScale) : containScale;
    const width = scale === undefined ? box.width : source.width * scale;
    const height = scale === undefined ? box.height : source.height * scale;
    return { left: box.left + (box.width - width) / 2, top: box.top + (box.height - height) / 2, width, height };
}
function polygonBounds(points) {
    const xs = points.map(([x]) => x);
    const ys = points.map(([, y]) => y);
    return { left: Math.min(...xs), top: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
}
function mapSourceRect(bounds, source, rendered) {
    return { left: rendered.left + bounds.left / source.width * rendered.width, top: rendered.top + bounds.top / source.height * rendered.height, width: bounds.width / source.width * rendered.width, height: bounds.height / source.height * rendered.height };
}

globalThis.MangaTrGeometry = { contentRect, polygonBounds, mapSourceRect };
/* MANGA_TR_GEOMETRY_END */
/* MANGA_TR_CAPTURE_START */
function computeVisibleImageCrop(imageRect, viewport, screenshot, natural) {
    if (imageRect.width <= 0 || imageRect.height <= 0 || viewport.width <= 0 || viewport.height <= 0)
        return null;
    const visibleLeft = Math.max(0, imageRect.left);
    const visibleTop = Math.max(0, imageRect.top);
    const visibleRight = Math.min(viewport.width, imageRect.left + imageRect.width);
    const visibleBottom = Math.min(viewport.height, imageRect.top + imageRect.height);
    if (visibleRight - visibleLeft < 40 || visibleBottom - visibleTop < 40)
        return null;
    const screenshotScaleX = screenshot.width / viewport.width;
    const screenshotScaleY = screenshot.height / viewport.height;
    return {
        source: {
            x: visibleLeft * screenshotScaleX,
            y: visibleTop * screenshotScaleY,
            width: (visibleRight - visibleLeft) * screenshotScaleX,
            height: (visibleBottom - visibleTop) * screenshotScaleY,
        },
        mapping: {
            naturalLeft: (visibleLeft - imageRect.left) * natural.width / imageRect.width,
            naturalTop: (visibleTop - imageRect.top) * natural.height / imageRect.height,
            naturalPerPixelX: natural.width / imageRect.width / screenshotScaleX,
            naturalPerPixelY: natural.height / imageRect.height / screenshotScaleY,
        },
    };
}

globalThis.MangaTrCapture = { computeVisibleImageCrop };
/* MANGA_TR_CAPTURE_END */
/* MANGA_TR_TEXT_FIT_START */
const MIN_FONT_SIZE = 8;
const MAX_FONT_SIZE = 44;
const MIN_LETTER_SPACING = 0;
const MAX_LETTER_SPACING = 0.6;
function finiteNumber(value, fallback) {
    return Number.isFinite(value) ? value : fallback;
}
function clamp(value, min, max) {
    return Math.min(max, Math.max(min, finiteNumber(value, min)));
}
function visibleLength(text) {
    return Array.from(text).length;
}
function measuredWidth(measureText, text, fontSize, fontFamily, letterSpacing) {
    const raw = finiteNumber(measureText({ text, fontSize, fontFamily, letterSpacing }), 0);
    return Math.max(0, raw + Math.max(0, visibleLength(text) - 1) * letterSpacing);
}
function splitLongWord(word, width, fontSize, fontFamily, letterSpacing, measureText) {
    const chars = Array.from(word);
    const chunks = [];
    let chunk = '';
    for (const char of chars) {
        const candidate = `${chunk}${char}`;
        if (chunk && measuredWidth(measureText, candidate, fontSize, fontFamily, letterSpacing) > width) {
            chunks.push(chunk);
            chunk = char;
        }
        else {
            chunk = candidate;
        }
    }
    if (chunk)
        chunks.push(chunk);
    return chunks.length ? chunks : [word];
}
function wrapText(text, width, fontSize, fontFamily, letterSpacing, measureText) {
    const words = text.trim().split(/\s+/).filter(Boolean);
    if (!words.length)
        return [''];
    const lines = [];
    let line = '';
    for (const word of words) {
        if (measuredWidth(measureText, word, fontSize, fontFamily, letterSpacing) > width) {
            if (line) {
                lines.push(line);
                line = '';
            }
            lines.push(...splitLongWord(word, width, fontSize, fontFamily, letterSpacing, measureText));
            continue;
        }
        const candidate = line ? `${line} ${word}` : word;
        if (line && measuredWidth(measureText, candidate, fontSize, fontFamily, letterSpacing) > width) {
            lines.push(line);
            line = word;
        }
        else {
            line = candidate;
        }
    }
    if (line)
        lines.push(line);
    return lines.length ? lines : [text.trim()];
}
/* AGENT_2_BAŞLANGIÇ */
function wrapTextWithBreaks(text, width, fontSize, fontFamily, letterSpacing, measureText) {
    const segments = String(text).split('\n');
    const lines = [];
    for (const segment of segments) {
        if (!segment.trim())
            continue;
        lines.push(...wrapText(segment, width, fontSize, fontFamily, letterSpacing, measureText));
    }
    return lines.length ? lines : wrapText(String(text).replace(/\n/g, ' '), width, fontSize, fontFamily, letterSpacing, measureText);
}
/* AGENT_2_BİTİŞ */
function maxLineWidth(lines, fontSize, fontFamily, letterSpacing, measureText) {
    return lines.reduce((max, line) => Math.max(max, measuredWidth(measureText, line, fontSize, fontFamily, letterSpacing)), 0);
}
function familyOrder(text, width, height) {
    const density = visibleLength(text.replace(/\s+/g, '')) / Math.max(1, width * height / 1000);
    return density > 2.15 ? ['condensed', 'regular'] : ['regular', 'condensed'];
}
function fitOverlayText(input) {
    const text = String(input.text ?? '').trim();
    const width = Math.max(1, finiteNumber(input.width, 1));
    const height = Math.max(1, finiteNumber(input.height, 1));
    const measureText = input.measureText;
    const compactTextLength = visibleLength(text.replace(/\s+/g, ''));
    const shortTextCap = compactTextLength <= 4 ? 26 : compactTextLength <= 9 ? 34 : MAX_FONT_SIZE;
    const heightCap = Math.max(MIN_FONT_SIZE, Math.floor(height * 0.72));
    const startSize = Math.floor(clamp(input.initialFontSize, MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, shortTextCap, heightCap)));
    const letterSpacings = [0, 0.15, 0.3, 0.45, 0.6].map((value) => clamp(value, MIN_LETTER_SPACING, MAX_LETTER_SPACING));
    let best = null;
    let bestOverflow = Number.POSITIVE_INFINITY;
    for (let fontSize = startSize; fontSize >= MIN_FONT_SIZE; fontSize -= 1) {
        for (const fontFamily of familyOrder(text, width, height)) {
            const lineHeight = Math.max(9, Math.round(fontSize * (fontFamily === 'condensed' ? 1.05 : 1.08)));
            for (const letterSpacing of letterSpacings) {
                /* AGENT_2_BAŞLANGIÇ */
                const lines = wrapTextWithBreaks(text, width * 0.94, fontSize, fontFamily, letterSpacing, measureText);
                /* AGENT_2_BİTİŞ */
                const blockHeight = lines.length * lineHeight;
                const widest = maxLineWidth(lines, fontSize, fontFamily, letterSpacing, measureText);
                const overflow = Math.max(0, widest - width * 0.96) + Math.max(0, blockHeight - height * 0.94);
                const candidate = { lines, fontSize, lineHeight, letterSpacing, fontFamily };
                if (overflow < bestOverflow) {
                    best = candidate;
                    bestOverflow = overflow;
                }
                if (overflow === 0)
                    return candidate;
            }
        }
    }
    return best ?? {
        lines: text ? [text] : [''],
        fontSize: MIN_FONT_SIZE,
        lineHeight: 9,
        letterSpacing: 0,
        fontFamily: 'regular',
    };
}

globalThis.MangaTrTextFit = { fitOverlayText };
/* MANGA_TR_TEXT_FIT_END */
"use strict";
var MangaTrContent;
(function (MangaTrContent) {
    const api = typeof browser !== 'undefined' ? browser : chrome;
    const ROOT_ID = 'manga-tr-overlay-root';
    const STYLE_ID = 'manga-tr-style';
    let enabled = false;
    let frame = 0;
    let pageObserver = null;
    let controller = null;
    let ocrFramePromise = null;
    let ocrRequestId = 0;
    const pendingOcr = new Map();
    const overlays = new Map();
    const ocrQueue = [];
    let queueRunning = false;
    let captureScrollLock = false;
    const ocrCache = new Map();
    const translationCache = new Map();
    document.documentElement.dataset.mangaTrReady = 'true';
    function extensionUrl(path) { return api.runtime.getURL(path); }
    function extensionOrigin() { return extensionUrl('').replace(/\/$/, ''); }
    function addStyle() {
        if (document.getElementById(STYLE_ID))
            return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
    #${ROOT_ID} { position:fixed; inset:0; z-index:2147483647; pointer-events:none; }
    .manga-tr-region { position:fixed; display:flex; align-items:center; justify-content:center; box-sizing:border-box; padding:2px 4px; border:0; outline:0; border-radius:5px; background:rgba(255,255,255,.98) !important; color:#111; font-family:Arial,sans-serif; font-weight:700; letter-spacing:0; line-height:1.06; text-align:center; text-shadow:none; white-space:pre-wrap; overflow:hidden; }
    .manga-tr-close { position:fixed; pointer-events:auto; width:32px; height:32px; border:0; border-radius:16px; background:#211b3c; color:#fff; font-size:20px; cursor:pointer; box-shadow:0 2px 8px #0006; }
    .manga-tr-ocr-status { position:fixed; right:10px; bottom:10px; max-width:280px; padding:7px 10px; border-radius:7px; background:#211b3cdd; color:#fff; font:12px system-ui,sans-serif; }
  `;
        document.head.append(style);
    }
    function root() {
        let node = document.getElementById(ROOT_ID);
        if (!node) {
            node = document.createElement('div');
            node.id = ROOT_ID;
            const close = document.createElement('button');
            close.className = 'manga-tr-close';
            close.textContent = '×';
            close.title = 'Overlay’i kapat';
            close.setAttribute('aria-label', 'Çeviri overlayini kapat');
            close.addEventListener('click', clearOverlays);
            node.append(close);
            document.documentElement.append(node);
        }
        return node;
    }
    function status(text) {
        const container = root();
        let node = container.querySelector('.manga-tr-ocr-status');
        if (!node) {
            node = document.createElement('div');
            node.className = 'manga-tr-ocr-status';
            container.append(node);
        }
        node.textContent = text;
    }
    function isMangaImage(image) {
        const rect = image.getBoundingClientRect();
        return image.isConnected && image.naturalWidth >= 300 && image.naturalHeight >= 300 && rect.width >= 220 && rect.height >= 220;
    }
    function isNearViewport(image) {
        const rect = image.getBoundingClientRect();
        const margin = innerHeight * 1.25;
        return rect.bottom > -margin && rect.top < innerHeight + margin;
    }
    function imageCacheKey(image) {
        return `${image.currentSrc || image.src}|${image.naturalWidth}x${image.naturalHeight}`;
    }
    function getOcrFrame() {
        if (!ocrFramePromise) {
            ocrFramePromise = new Promise((resolve, reject) => {
                const frame = document.createElement('iframe');
                frame.src = extensionUrl('ocr-frame.html');
                frame.style.display = 'none';
                let settled = false;
                const ready = () => {
                    if (settled)
                        return;
                    settled = true;
                    window.clearTimeout(timer);
                    window.removeEventListener('message', onReady);
                    resolve(frame);
                };
                const fail = (error) => {
                    if (settled)
                        return;
                    settled = true;
                    window.clearTimeout(timer);
                    window.removeEventListener('message', onReady);
                    frame.remove();
                    ocrFramePromise = null;
                    reject(error);
                };
                const timer = window.setTimeout(() => fail(new Error('Yerel OCR iframe’i hazır olmadı.')), 10000);
                const onReady = (event) => {
                    if (event.source !== frame.contentWindow || event.origin !== extensionOrigin())
                        return;
                    if (event.data?.type !== 'MANGA_TR_OCR_READY')
                        return;
                    ready();
                };
                window.addEventListener('message', onReady);
                frame.onload = ready;
                frame.onerror = () => fail(new Error('Yerel OCR iframe’i başlatılamadı.'));
                document.documentElement.append(frame);
            });
        }
        return ocrFramePromise;
    }
    window.addEventListener('message', (event) => {
        const message = event.data;
        if (message?.type === 'MANGA_TR_OCR_READY')
            return;
        if (!message?.id || !String(message.type).startsWith('MANGA_TR_OCR_'))
            return;
        if (event.origin !== extensionOrigin())
            return;
        const pending = pendingOcr.get(message.id);
        if (!pending)
            return;
        pendingOcr.delete(message.id);
        if (message.type === 'MANGA_TR_OCR_ERROR')
            pending.reject(new Error(message.message || 'Yerel OCR başarısız.'));
        else
            pending.resolve(message.boxes ?? []);
    });
    async function recognizeDataUrlLocally(dataUrl) {
        const frame = await getOcrFrame();
        const id = `ocr-${++ocrRequestId}`;
        const result = new Promise((resolve, reject) => pendingOcr.set(id, { resolve, reject }));
        frame.contentWindow?.postMessage({ type: 'MANGA_TR_OCR', id, dataUrl }, extensionOrigin());
        const timeout = new Promise((_, reject) => setTimeout(() => {
            pendingOcr.delete(id);
            reject(new Error('Yerel OCR zaman aşımına uğradı.'));
        }, 45000));
        return Promise.race([result, timeout]);
    }
    async function pageManagedDataUrl(imageUrl) {
        if (imageUrl.startsWith('data:image/'))
            return imageUrl;
        if (!imageUrl.startsWith('blob:'))
            return '';
        const response = await fetch(imageUrl);
        if (!response.ok)
            throw new Error(`Blob görseli okunamadı (${response.status}).`);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result ?? ''));
            reader.onerror = () => reject(new Error('Blob görseli data URL’ye dönüştürülemedi.'));
            reader.readAsDataURL(blob);
        });
    }
    function waitForViewportPaint() {
        return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 650))));
    }
    async function captureScreenshotImage() {
        let captured = await api.runtime.sendMessage({ type: 'CAPTURE_VISIBLE_TAB' });
        if (String(captured?.error ?? '').includes('MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND')) {
            await new Promise((resolve) => setTimeout(resolve, 850));
            captured = await api.runtime.sendMessage({ type: 'CAPTURE_VISIBLE_TAB' });
        }
        if (captured?.error || !captured?.dataUrl)
            throw new Error(captured?.error || 'Sekme görüntüsü alınamadı.');
        const screenshot = new Image();
        screenshot.src = captured.dataUrl;
        await screenshot.decode();
        return screenshot;
    }
    async function recognizeScrolledScreenshot(image) {
        if (!image.isConnected || image.naturalWidth <= 0 || image.naturalHeight <= 0)
            throw new Error('Görsel ekran yakalama için hazır değil.');
        const originalScroll = { x: scrollX, y: scrollY };
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext('2d');
        if (!context)
            throw new Error('Tam görsel yakalama canvası oluşturulamadı.');
        let naturalY = 0;
        let captures = 0;
        captureScrollLock = true;
        try {
            while (naturalY < image.naturalHeight - 1) {
                let naturalX = 0;
                let completedRowBottom = image.naturalHeight;
                while (naturalX < image.naturalWidth - 1) {
                    let crop = null;
                    let screenshot = null;
                    let rect = image.getBoundingClientRect();
                    for (let reposition = 0; reposition < 10 && !crop; reposition += 1) {
                        if (++captures > 120)
                            throw new Error('Tam görsel ekran yakalama güvenlik sınırını aştı.');
                        const before = image.getBoundingClientRect();
                        if (before.width <= 0 || before.height <= 0)
                            throw new Error('Görselin sayfadaki boyutu hesaplanamadı.');
                        const documentLeft = before.left + scrollX;
                        const documentTop = before.top + scrollY;
                        const targetX = documentLeft + (naturalX / image.naturalWidth) * before.width - 16;
                        const targetY = documentTop + (naturalY / image.naturalHeight) * before.height - 16;
                        scrollTo({ left: Math.max(0, targetX), top: Math.max(0, targetY), behavior: 'instant' });
                        await waitForViewportPaint();
                        screenshot = await captureScreenshotImage();
                        rect = image.getBoundingClientRect();
                        const candidate = MangaTrCapture.computeVisibleImageCrop({ left: rect.left, top: rect.top, width: rect.width, height: rect.height }, { width: innerWidth, height: innerHeight }, { width: screenshot.naturalWidth, height: screenshot.naturalHeight }, { width: image.naturalWidth, height: image.naturalHeight });
                        if (candidate) {
                            const candidateRight = candidate.mapping.naturalLeft + candidate.source.width * candidate.mapping.naturalPerPixelX;
                            const candidateBottom = candidate.mapping.naturalTop + candidate.source.height * candidate.mapping.naturalPerPixelY;
                            if (candidateRight > naturalX + 1 && candidateBottom > naturalY + 1)
                                crop = candidate;
                        }
                    }
                    if (!crop || !screenshot) {
                        throw new Error(`Görsel ekran görüntüsünde görünür hale getirilemedi (rect=${Math.round(rect.left)},${Math.round(rect.top)},${Math.round(rect.width)}x${Math.round(rect.height)}; viewport=${innerWidth}x${innerHeight}; capture=${screenshot?.naturalWidth ?? 0}x${screenshot?.naturalHeight ?? 0}; scroll=${Math.round(scrollX)},${Math.round(scrollY)}).`);
                    }
                    const destinationLeft = crop.mapping.naturalLeft;
                    const destinationTop = crop.mapping.naturalTop;
                    const destinationWidth = crop.source.width * crop.mapping.naturalPerPixelX;
                    const destinationHeight = crop.source.height * crop.mapping.naturalPerPixelY;
                    context.drawImage(screenshot, crop.source.x, crop.source.y, crop.source.width, crop.source.height, destinationLeft, destinationTop, destinationWidth, destinationHeight);
                    const right = Math.min(image.naturalWidth, destinationLeft + destinationWidth);
                    const bottom = Math.min(image.naturalHeight, destinationTop + destinationHeight);
                    completedRowBottom = Math.min(completedRowBottom, bottom);
                    if (right <= naturalX + 1)
                        throw new Error('Görselin yatay ekran yakalaması ilerleyemedi.');
                    naturalX = right >= image.naturalWidth - 1 ? image.naturalWidth : Math.max(naturalX + 1, right - 8);
                }
                if (completedRowBottom <= naturalY + 1)
                    throw new Error('Görselin dikey ekran yakalaması ilerleyemedi.');
                naturalY = completedRowBottom >= image.naturalHeight - 1 ? image.naturalHeight : Math.max(naturalY + 1, completedRowBottom - 8);
            }
            return recognizeDataUrlLocally(canvas.toDataURL('image/png'));
        }
        finally {
            scrollTo({ left: originalScroll.x, top: originalScroll.y, behavior: 'instant' });
            await waitForViewportPaint();
            captureScrollLock = false;
        }
    }
    async function recognizeImageLocally(image) {
        const imageUrl = image.currentSrc || image.src;
        try {
            let dataUrl = await pageManagedDataUrl(imageUrl);
            if (!dataUrl) {
                const fetched = await api.runtime.sendMessage({ type: 'FETCH_IMAGE', url: imageUrl });
                if (fetched?.error)
                    throw new Error(fetched.error);
                dataUrl = fetched?.dataUrl ?? '';
            }
            if (!dataUrl.startsWith('data:image/'))
                throw new Error('OCR görsel verisi alınamadı veya görsel biçimi geçersiz.');
            return await recognizeDataUrlLocally(dataUrl);
        }
        catch (primaryError) {
            console.warn('Doğrudan görsel erişimi başarısız; ekran yakalama fallback’i deneniyor.', primaryError);
            return recognizeScrolledScreenshot(image);
        }
    }
    /* AGENT_2_BAŞLANGIÇ */
    function mergeAdjacentBoxes(boxes) {
        const sorted = [...boxes].sort((a, b) => a.top - b.top || a.left - b.left);
        const merged = [];
        for (const box of sorted) {
            const prev = merged[merged.length - 1];
            if (prev) {
                const prevBottom = prev.top + prev.height;
                const gap = box.top - prevBottom;
                const prevLineHeight = prev.height / Math.max(1, prev.lineCount ?? 1);
                const boxLineHeight = box.height / Math.max(1, box.lineCount ?? 1);
                const lineHeight = Math.max(prevLineHeight, boxLineHeight);
                const overlapLeft = Math.max(prev.left, box.left);
                const overlapRight = Math.min(prev.left + prev.width, box.left + box.width);
                const overlapWidth = overlapRight - overlapLeft;
                const minOverlap = Math.min(prev.width, box.width) * 0.45;
                if (gap >= -lineHeight * 0.4 && gap <= lineHeight * 1.6 && overlapWidth >= minOverlap) {
                    const left = Math.min(prev.left, box.left);
                    const top = Math.min(prev.top, box.top);
                    const right = Math.max(prev.left + prev.width, box.left + box.width);
                    const bottom = Math.max(prevBottom, box.top + box.height);
                    merged[merged.length - 1] = {
                        text: `${prev.text}\n${box.text}`,
                        confidence: Math.min(prev.confidence, box.confidence),
                        left: left,
                        top: top,
                        width: right - left,
                        height: bottom - top,
                        lineCount: (prev.lineCount ?? 1) + (box.lineCount ?? 1),
                    };
                    continue;
                }
            }
            merged.push({ ...box });
        }
        return merged;
    }
    /* AGENT_2_BİTİŞ */
    async function translateBoxes(boxes) {
        /* AGENT_2_BAŞLANGIÇ */
        const sourceBoxes = mergeAdjacentBoxes(boxes);
        /* AGENT_2_BİTİŞ */
        const missing = Array.from(new Set(sourceBoxes.map((box) => box.text.trim()).filter((text) => text && !translationCache.has(text))));
        if (missing.length) {
            const response = await api.runtime.sendMessage({ type: 'TRANSLATE_TEXTS', texts: missing });
            if (response?.error)
                throw new Error(response.error);
            if (!Array.isArray(response?.translations) || response.translations.length !== missing.length)
                throw new Error('DeepL geçerli bir çeviri listesi döndürmedi.');
            missing.forEach((source, index) => translationCache.set(source, String(response.translations[index]).trim()));
        }
        return sourceBoxes.map((box) => ({ ...box, text: translationCache.get(box.text.trim()) ?? '' })).filter((box) => box.text);
    }
    function renderState(state) {
        const rect = state.image.getBoundingClientRect();
        state.node.replaceChildren();
        const visible = rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth;
        state.node.style.display = visible ? 'block' : 'none';
        if (!visible)
            return;
        const measure = document.createElement('canvas').getContext('2d');
        const fontFamilies = {
            condensed: '"Arial Narrow","Roboto Condensed",Arial,sans-serif',
            regular: 'Arial,Helvetica,sans-serif'
        };
        const measureOverlayText = (sample) => {
            if (!measure)
                return sample.text.length * sample.fontSize * (sample.fontFamily === 'condensed' ? 0.48 : 0.58);
            measure.font = `700 ${sample.fontSize}px ${fontFamilies[sample.fontFamily]}`;
            return measure.measureText(sample.text).width;
        };
        for (const box of state.boxes) {
            const region = document.createElement('div');
            region.className = 'manga-tr-region';
            const scaleX = rect.width / state.image.naturalWidth;
            const scaleY = rect.height / state.image.naturalHeight;
            const sourceLineHeight = box.height / Math.max(1, box.lineCount ?? 1);
            const padX = Math.max(3, sourceLineHeight * 0.22);
            const padY = Math.max(2, sourceLineHeight * 0.16);
            const boxWidth = Math.max(24, Math.min(rect.width * 0.78, (box.width + padX * 2) * scaleX));
            const boxHeight = Math.max(18, Math.min(rect.height * 0.22, (box.height + padY * 2) * scaleY));
            const fit = MangaTrTextFit.fitOverlayText({
                text: box.text,
                width: boxWidth - 8,
                height: boxHeight - 4,
                initialFontSize: sourceLineHeight * scaleY * 0.9,
                measureText: measureOverlayText
            });
            const unclampedLeft = rect.left + (box.left - padX) * scaleX;
            const unclampedTop = rect.top + (box.top - padY) * scaleY;
            Object.assign(region.style, {
                left: `${Math.max(rect.left, Math.min(unclampedLeft, rect.right - boxWidth))}px`,
                top: `${Math.max(rect.top, Math.min(unclampedTop, rect.bottom - boxHeight))}px`,
                width: `${boxWidth}px`,
                height: `${boxHeight}px`,
                fontSize: `${fit.fontSize}px`,
                fontFamily: fontFamilies[fit.fontFamily],
                letterSpacing: `${fit.letterSpacing}px`,
                lineHeight: `${fit.lineHeight}px`
            });
            region.textContent = fit.lines.join('\n');
            state.node.append(region);
        }
    }
    function render() {
        if (!enabled)
            return;
        for (const state of overlays.values())
            renderState(state);
        const close = root().querySelector('.manga-tr-close');
        if (close)
            Object.assign(close.style, { left: `${Math.max(8, innerWidth - 44)}px`, top: '10px' });
    }
    function scheduleRender() {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(render);
    }
    function filterEnglishOcrBoxes(boxes) {
        return boxes.filter((box) => {
            const text = String(box.text ?? '').trim();
            const confidence = Number(box.confidence);
            const isAsciiWord = /^[A-Za-z0-9\s.,!?;:'"()\-]+$/.test(text);
            const isLongEnough = text.length >= 2;
            const hasReliableConfidence = Number.isFinite(confidence) && confidence >= 50;
            const hasRepeatedLetter = /(.)\1\1\1/i.test(text);
            if (!isAsciiWord || !isLongEnough || !hasReliableConfidence || hasRepeatedLetter) {
                console.warn('[MangaTR OCR FILTERED]', text, confidence);
                return false;
            }
            return true;
        });
    }
    async function processImage(image, state) {
        if (state.busy || !enabled)
            return;
        state.queued = false;
        state.busy = true;
        try {
            status(`Yerel OCR çalışıyor: ${overlays.size - ocrQueue.length} / ${overlays.size} görsel`);
            const key = imageCacheKey(image);
            const rawBoxes = filterEnglishOcrBoxes(ocrCache.get(key) ?? await recognizeImageLocally(image));
            ocrCache.set(key, rawBoxes);
            if (!rawBoxes.length)
                throw new Error('Bu görselde güvenilir İngilizce metin bulunamadı.');
            status(`DeepL çeviriyor: ${rawBoxes.length} metin bölgesi`);
            state.boxes = await translateBoxes(rawBoxes);
            renderState(state);
        }
        catch (error) {
            const detail = error instanceof Error ? error.message : String(error);
            console.error('OCR/çeviri başarısız:', error);
            status(`Bu görsel işlenemedi: ${detail}`);
        }
        finally {
            state.busy = false;
            state.processed = true;
            queueRunning = false;
            pumpQueue();
        }
    }
    /* AGENT_GOREV1_BİTİŞ */
    function pumpQueue() {
        if (!enabled || queueRunning)
            return;
        const next = ocrQueue.shift();
        if (next) {
            queueRunning = true;
            void processImage(next.image, next);
        }
    }
    function queueVisibleImages() {
        if (captureScrollLock)
            return;
        for (const state of overlays.values()) {
            if (!state.busy && !state.queued && !state.processed && isNearViewport(state.image)) {
                state.queued = true;
                ocrQueue.push(state);
            }
        }
        pumpQueue();
    }
    function ensureOverlays() {
        const container = root();
        for (const image of Array.from(document.images)) {
            if (!isMangaImage(image) || overlays.has(image))
                continue;
            const node = document.createElement('div');
            const state = { image, boxes: [], node, busy: false, queued: false, processed: false };
            overlays.set(image, state);
            container.append(node);
        }
        queueVisibleImages();
        for (const [image, state] of overlays) {
            if (isMangaImage(image))
                continue;
            state.node.remove();
            overlays.delete(image);
        }
    }
    function startPageTranslation() {
        clearOverlays();
        enabled = true;
        addStyle();
        ensureOverlays();
        controller = new AbortController();
        window.addEventListener('resize', scheduleRender, { passive: true, signal: controller.signal });
        window.addEventListener('scroll', scheduleRender, { passive: true, capture: true, signal: controller.signal });
        window.addEventListener('scroll', queueVisibleImages, { passive: true, capture: true, signal: controller.signal });
        document.addEventListener('load', scheduleRender, { capture: true, signal: controller.signal });
        pageObserver = new MutationObserver(() => { ensureOverlays(); scheduleRender(); });
        pageObserver.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['src', 'srcset', 'style', 'class', 'width', 'height'] });
        render();
    }
    function clearOverlays() {
        enabled = false;
        cancelAnimationFrame(frame);
        controller?.abort();
        controller = null;
        pageObserver?.disconnect();
        pageObserver = null;
        ocrQueue.length = 0;
        queueRunning = false;
        captureScrollLock = false;
        for (const pending of pendingOcr.values())
            pending.reject(new Error('OCR iptal edildi.'));
        pendingOcr.clear();
        document.querySelector('iframe[src$="/ocr-frame.html"]')?.remove();
        ocrFramePromise = null;
        for (const state of overlays.values())
            state.node.remove();
        overlays.clear();
        document.getElementById(ROOT_ID)?.remove();
    }
    api.runtime.onMessage.addListener((message) => {
        if (message.type === 'START_PAGE_TRANSLATION')
            startPageTranslation();
        if (message.type === 'CLEAR_OVERLAY')
            clearOverlays();
    });
})(MangaTrContent || (MangaTrContent = {}));

```

### 7.3 extension-source\src\content\content.ts (526 satır)

```js
/* AGENT_GOREV1_BAŞLANGIÇ */
namespace MangaTrContent {
declare const chrome: any;
declare const browser: any;
declare const MangaTrCapture: { computeVisibleImageCrop: (imageRect: { left: number; top: number; width: number; height: number }, viewport: { width: number; height: number }, screenshot: { width: number; height: number }, natural: { width: number; height: number }) => { source: { x: number; y: number; width: number; height: number }; mapping: { naturalLeft: number; naturalTop: number; naturalPerPixelX: number; naturalPerPixelY: number } } | null };

const api = typeof browser !== 'undefined' ? browser : chrome;
type ExtensionMessage = { type: 'START_PAGE_TRANSLATION' } | { type: 'CLEAR_OVERLAY' };
type OcrBox = { text: string; confidence: number; left: number; top: number; width: number; height: number; lineCount?: number };
type OverlayState = { image: HTMLImageElement; boxes: OcrBox[]; node: HTMLElement; busy: boolean; queued: boolean; processed: boolean };

const ROOT_ID = 'manga-tr-overlay-root';
const STYLE_ID = 'manga-tr-style';
let enabled = false;
let frame = 0;
let pageObserver: MutationObserver | null = null;
let controller: AbortController | null = null;
let ocrFramePromise: Promise<HTMLIFrameElement> | null = null;
let ocrRequestId = 0;
const pendingOcr = new Map<string, { resolve: (boxes: OcrBox[]) => void; reject: (error: Error) => void }>();
const overlays = new Map<HTMLImageElement, OverlayState>();
const ocrQueue: OverlayState[] = [];
let queueRunning = false;
let captureScrollLock = false;
const ocrCache = new Map<string, OcrBox[]>();
const translationCache = new Map<string, string>();

document.documentElement.dataset.mangaTrReady = 'true';

function extensionUrl(path: string) { return api.runtime.getURL(path); }
function extensionOrigin() { return extensionUrl('').replace(/\/$/, ''); }

function addStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    #${ROOT_ID} { position:fixed; inset:0; z-index:2147483647; pointer-events:none; }
    .manga-tr-region { position:fixed; display:flex; align-items:center; justify-content:center; box-sizing:border-box; padding:2px 4px; border:0; outline:0; border-radius:5px; background:rgba(255,255,255,.98) !important; color:#111; font-family:"Arial Narrow","Roboto Condensed",Arial,sans-serif; font-weight:700; letter-spacing:0; line-height:1.06; text-align:center; text-shadow:none; white-space:pre-wrap; overflow:hidden; }
    .manga-tr-close { position:fixed; pointer-events:auto; width:32px; height:32px; border:0; border-radius:16px; background:#211b3c; color:#fff; font-size:20px; cursor:pointer; box-shadow:0 2px 8px #0006; }
    .manga-tr-ocr-status { position:fixed; right:10px; bottom:10px; max-width:280px; padding:7px 10px; border-radius:7px; background:#211b3cdd; color:#fff; font:12px system-ui,sans-serif; }
  `;
  document.head.append(style);
}

function root(): HTMLElement {
  let node = document.getElementById(ROOT_ID);
  if (!node) {
    node = document.createElement('div');
    node.id = ROOT_ID;
    const close = document.createElement('button');
    close.className = 'manga-tr-close';
    close.textContent = '×';
    close.title = 'Overlay’i kapat';
    close.setAttribute('aria-label', 'Çeviri overlayini kapat');
    close.addEventListener('click', clearOverlays);
    node.append(close);
    document.documentElement.append(node);
  }
  return node;
}

function status(text: string) {
  const container = root();
  let node = container.querySelector<HTMLElement>('.manga-tr-ocr-status');
  if (!node) { node = document.createElement('div'); node.className = 'manga-tr-ocr-status'; container.append(node); }
  node.textContent = text;
}

function isMangaImage(image: HTMLImageElement): boolean {
  const rect = image.getBoundingClientRect();
  return image.isConnected && image.naturalWidth >= 300 && image.naturalHeight >= 300 && rect.width >= 220 && rect.height >= 220;
}

function isNearViewport(image: HTMLImageElement): boolean {
  const rect = image.getBoundingClientRect();
  const margin = innerHeight * 1.25;
  return rect.bottom > -margin && rect.top < innerHeight + margin;
}

function imageCacheKey(image: HTMLImageElement) {
  return `${image.currentSrc || image.src}|${image.naturalWidth}x${image.naturalHeight}`;
}

function getOcrFrame() {
  if (!ocrFramePromise) {
    ocrFramePromise = new Promise<HTMLIFrameElement>((resolve, reject) => {
      const frame = document.createElement('iframe');
      frame.src = extensionUrl('ocr-frame.html');
      frame.style.display = 'none';
      let settled = false;
      const ready = () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        window.removeEventListener('message', onReady);
        resolve(frame);
      };
      const fail = (error: Error) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        window.removeEventListener('message', onReady);
        frame.remove();
        ocrFramePromise = null;
        reject(error);
      };
      const timer = window.setTimeout(() => fail(new Error('Yerel OCR iframe’i hazır olmadı.')), 10000);
      const onReady = (event: MessageEvent) => {
        if (event.source !== frame.contentWindow || event.origin !== extensionOrigin()) return;
        if (event.data?.type !== 'MANGA_TR_OCR_READY') return;
        ready();
      };
      window.addEventListener('message', onReady);
      frame.onload = ready;
      frame.onerror = () => fail(new Error('Yerel OCR iframe’i başlatılamadı.'));
      document.documentElement.append(frame);
    });
  }
  return ocrFramePromise;
}

window.addEventListener('message', (event) => {
  const message = event.data;
  if (message?.type === 'MANGA_TR_OCR_READY') return;
  if (!message?.id || !String(message.type).startsWith('MANGA_TR_OCR_')) return;
  if (event.origin !== extensionOrigin()) return;
  const pending = pendingOcr.get(message.id);
  if (!pending) return;
  pendingOcr.delete(message.id);
  if (message.type === 'MANGA_TR_OCR_ERROR') pending.reject(new Error(message.message || 'Yerel OCR başarısız.'));
  else pending.resolve(message.boxes ?? []);
});

async function recognizeDataUrlLocally(dataUrl: string): Promise<OcrBox[]> {
  const frame = await getOcrFrame();
  const id = `ocr-${++ocrRequestId}`;
  const result = new Promise<OcrBox[]>((resolve, reject) => pendingOcr.set(id, { resolve, reject }));
  frame.contentWindow?.postMessage({ type: 'MANGA_TR_OCR', id, dataUrl }, extensionOrigin());
  const timeout = new Promise<OcrBox[]>((_, reject) => setTimeout(() => {
    pendingOcr.delete(id);
    reject(new Error('Yerel OCR zaman aşımına uğradı.'));
  }, 45000));
  return Promise.race([result, timeout]);
}

async function pageManagedDataUrl(imageUrl: string): Promise<string> {
  if (imageUrl.startsWith('data:image/')) return imageUrl;
  if (!imageUrl.startsWith('blob:')) return '';
  const response = await fetch(imageUrl);
  if (!response.ok) throw new Error(`Blob görseli okunamadı (${response.status}).`);
  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Blob görseli data URL’ye dönüştürülemedi.'));
    reader.readAsDataURL(blob);
  });
}

function waitForViewportPaint(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 650))));
}

async function captureScreenshotImage(): Promise<HTMLImageElement> {
  let captured = await api.runtime.sendMessage({ type: 'CAPTURE_VISIBLE_TAB' });
  if (String(captured?.error ?? '').includes('MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND')) {
    await new Promise((resolve) => setTimeout(resolve, 850));
    captured = await api.runtime.sendMessage({ type: 'CAPTURE_VISIBLE_TAB' });
  }
  if (captured?.error || !captured?.dataUrl) throw new Error(captured?.error || 'Sekme görüntüsü alınamadı.');
  const screenshot = new Image();
  screenshot.src = captured.dataUrl;
  await screenshot.decode();
  return screenshot;
}

async function recognizeScrolledScreenshot(image: HTMLImageElement): Promise<OcrBox[]> {
  if (!image.isConnected || image.naturalWidth <= 0 || image.naturalHeight <= 0) throw new Error('Görsel ekran yakalama için hazır değil.');
  const originalScroll = { x: scrollX, y: scrollY };
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Tam görsel yakalama canvası oluşturulamadı.');

  let naturalY = 0;
  let captures = 0;
  captureScrollLock = true;
  try {
    while (naturalY < image.naturalHeight - 1) {
      let naturalX = 0;
      let completedRowBottom = image.naturalHeight;
      while (naturalX < image.naturalWidth - 1) {
        let crop: ReturnType<typeof MangaTrCapture.computeVisibleImageCrop> = null;
        let screenshot: HTMLImageElement | null = null;
        let rect = image.getBoundingClientRect();
        for (let reposition = 0; reposition < 10 && !crop; reposition += 1) {
          if (++captures > 120) throw new Error('Tam görsel ekran yakalama güvenlik sınırını aştı.');
          const before = image.getBoundingClientRect();
          if (before.width <= 0 || before.height <= 0) throw new Error('Görselin sayfadaki boyutu hesaplanamadı.');
          const documentLeft = before.left + scrollX;
          const documentTop = before.top + scrollY;
          const targetX = documentLeft + (naturalX / image.naturalWidth) * before.width - 16;
          const targetY = documentTop + (naturalY / image.naturalHeight) * before.height - 16;
          scrollTo({ left: Math.max(0, targetX), top: Math.max(0, targetY), behavior: 'instant' });
          await waitForViewportPaint();

          screenshot = await captureScreenshotImage();
          rect = image.getBoundingClientRect();
          const candidate = MangaTrCapture.computeVisibleImageCrop(
            { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
            { width: innerWidth, height: innerHeight },
            { width: screenshot.naturalWidth, height: screenshot.naturalHeight },
            { width: image.naturalWidth, height: image.naturalHeight },
          );
          if (candidate) {
            const candidateRight = candidate.mapping.naturalLeft + candidate.source.width * candidate.mapping.naturalPerPixelX;
            const candidateBottom = candidate.mapping.naturalTop + candidate.source.height * candidate.mapping.naturalPerPixelY;
            if (candidateRight > naturalX + 1 && candidateBottom > naturalY + 1) crop = candidate;
          }
        }
        if (!crop || !screenshot) {
          throw new Error(`Görsel ekran görüntüsünde görünür hale getirilemedi (rect=${Math.round(rect.left)},${Math.round(rect.top)},${Math.round(rect.width)}x${Math.round(rect.height)}; viewport=${innerWidth}x${innerHeight}; capture=${screenshot?.naturalWidth ?? 0}x${screenshot?.naturalHeight ?? 0}; scroll=${Math.round(scrollX)},${Math.round(scrollY)}).`);
        }

        const destinationLeft = crop.mapping.naturalLeft;
        const destinationTop = crop.mapping.naturalTop;
        const destinationWidth = crop.source.width * crop.mapping.naturalPerPixelX;
        const destinationHeight = crop.source.height * crop.mapping.naturalPerPixelY;
        context.drawImage(
          screenshot,
          crop.source.x,
          crop.source.y,
          crop.source.width,
          crop.source.height,
          destinationLeft,
          destinationTop,
          destinationWidth,
          destinationHeight,
        );

        const right = Math.min(image.naturalWidth, destinationLeft + destinationWidth);
        const bottom = Math.min(image.naturalHeight, destinationTop + destinationHeight);
        completedRowBottom = Math.min(completedRowBottom, bottom);
        if (right <= naturalX + 1) throw new Error('Görselin yatay ekran yakalaması ilerleyemedi.');
        naturalX = right >= image.naturalWidth - 1 ? image.naturalWidth : Math.max(naturalX + 1, right - 8);
      }
      if (completedRowBottom <= naturalY + 1) throw new Error('Görselin dikey ekran yakalaması ilerleyemedi.');
      naturalY = completedRowBottom >= image.naturalHeight - 1 ? image.naturalHeight : Math.max(naturalY + 1, completedRowBottom - 8);
    }
    return recognizeDataUrlLocally(canvas.toDataURL('image/png'));
  } finally {
    scrollTo({ left: originalScroll.x, top: originalScroll.y, behavior: 'instant' });
    await waitForViewportPaint();
    captureScrollLock = false;
  }
}

async function recognizeImageLocally(image: HTMLImageElement): Promise<OcrBox[]> {
  const imageUrl = image.currentSrc || image.src;
  try {
    let dataUrl = await pageManagedDataUrl(imageUrl);
    if (!dataUrl) {
      const fetched = await api.runtime.sendMessage({ type: 'FETCH_IMAGE', url: imageUrl });
      if (fetched?.error) throw new Error(fetched.error);
      dataUrl = fetched?.dataUrl ?? '';
    }
    if (!dataUrl.startsWith('data:image/')) throw new Error('OCR görsel verisi alınamadı veya görsel biçimi geçersiz.');
    return await recognizeDataUrlLocally(dataUrl);
  } catch (primaryError) {
    console.warn('Doğrudan görsel erişimi başarısız; ekran yakalama fallback’i deneniyor.', primaryError);
    return recognizeScrolledScreenshot(image);
  }
}

/* AGENT_2_BAŞLANGIÇ */
function mergeAdjacentBoxes(boxes: OcrBox[]): OcrBox[] {
  const sorted = [...boxes].sort((a, b) => a.top - b.top || a.left - b.left);
  const merged: OcrBox[] = [];
  for (const box of sorted) {
    const prev = merged[merged.length - 1];
    if (prev) {
      const prevBottom = prev.top + prev.height;
      const gap = box.top - prevBottom;
      const prevLineHeight = prev.height / Math.max(1, prev.lineCount ?? 1);
      const boxLineHeight = box.height / Math.max(1, box.lineCount ?? 1);
      const lineHeight = Math.max(prevLineHeight, boxLineHeight);
      const overlapLeft = Math.max(prev.left, box.left);
      const overlapRight = Math.min(prev.left + prev.width, box.left + box.width);
      const overlapWidth = overlapRight - overlapLeft;
      const minOverlap = Math.min(prev.width, box.width) * 0.45;
      if (gap >= -lineHeight * 0.4 && gap <= lineHeight * 1.6 && overlapWidth >= minOverlap) {
        const left = Math.min(prev.left, box.left);
        const top = Math.min(prev.top, box.top);
        const right = Math.max(prev.left + prev.width, box.left + box.width);
        const bottom = Math.max(prevBottom, box.top + box.height);
        merged[merged.length - 1] = {
          text: `${prev.text}\n${box.text}`,
          confidence: Math.min(prev.confidence, box.confidence),
          left,
          top,
          width: right - left,
          height: bottom - top,
          lineCount: (prev.lineCount ?? 1) + (box.lineCount ?? 1),
        };
        continue;
      }
    }
    merged.push({ ...box });
  }
  return merged;
}
/* AGENT_2_BİTİŞ */

async function translateBoxes(boxes: OcrBox[]): Promise<OcrBox[]> {
  /* AGENT_2_BAŞLANGIÇ */
  const sourceBoxes = mergeAdjacentBoxes(boxes);
  /* AGENT_2_BİTİŞ */
  const missing = Array.from(new Set(sourceBoxes.map((box) => box.text.trim()).filter((text) => text && !translationCache.has(text))));
  if (missing.length) {
    const response = await api.runtime.sendMessage({ type: 'TRANSLATE_TEXTS', texts: missing });
    if (response?.error) throw new Error(response.error);
    if (!Array.isArray(response?.translations) || response.translations.length !== missing.length) throw new Error('DeepL geçerli bir çeviri listesi döndürmedi.');
    missing.forEach((source, index) => translationCache.set(source, String(response.translations[index]).trim()));
  }
  return sourceBoxes.map((box) => ({ ...box, text: translationCache.get(box.text.trim()) ?? '' })).filter((box) => box.text);
}

function renderState(state: OverlayState) {
  const rect = state.image.getBoundingClientRect();
  state.node.replaceChildren();
  const visible = rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth;
  state.node.style.display = visible ? 'block' : 'none';
  if (!visible) return;
  const measure = document.createElement('canvas').getContext('2d');
  const fitText = (text: string, width: number, height: number, initialSize: number) => {
    /* AGENT_2_BAŞLANGIÇ */
    const segments = text.split('\n').map((segment) => segment.trim()).filter(Boolean);
    const words: string[] = [];
    for (const segment of segments) {
      const segmentWords = segment.split(/\s+/).filter(Boolean);
      segmentWords.forEach((word, index) => words.push(index === segmentWords.length - 1 ? `${word}\n` : word));
    }
    /* AGENT_2_BİTİŞ */
    let size = Math.max(10, Math.min(48, initialSize));
    let lines = [text];
    while (size >= 8) {
      if (measure) measure.font = `700 ${size}px Arial Narrow, Arial, sans-serif`;
      const next: string[] = [];
      let line = '';
      /* AGENT_2_BAŞLANGIÇ */
      for (const rawWord of words) {
        const word = rawWord.endsWith('\n') ? rawWord.slice(0, -1) : rawWord;
        const candidate = line ? `${line} ${word}` : word;
        if (measure && line && measure.measureText(candidate).width > width * 0.92) { next.push(line); line = word; }
        else line = candidate;
        if (rawWord.endsWith('\n')) { next.push(line); line = ''; }
      }
      /* AGENT_2_BİTİŞ */
      if (line) next.push(line);
      lines = next.length ? next : [text];
      const lineHeight = size * 1.06;
      if (lineHeight * lines.length <= height * 0.92) break;
      size -= 1;
    }
    return { text: lines.join('\n'), size: Math.max(8, size), lineHeight: Math.max(9, size * 1.06) };
  };
  for (const box of state.boxes) {
    const region = document.createElement('div');
    region.className = 'manga-tr-region';
    const scaleX = rect.width / state.image.naturalWidth;
    const scaleY = rect.height / state.image.naturalHeight;
    const sourceLineHeight = box.height / Math.max(1, box.lineCount ?? 1);
    const padX = Math.max(3, sourceLineHeight * 0.22);
    const padY = Math.max(2, sourceLineHeight * 0.16);
    const boxWidth = Math.max(24, Math.min(rect.width * 0.78, (box.width + padX * 2) * scaleX));
    const boxHeight = Math.max(18, Math.min(rect.height * 0.22, (box.height + padY * 2) * scaleY));
    const fit = fitText(box.text, boxWidth - 8, boxHeight - 4, sourceLineHeight * scaleY * 0.86);
    const unclampedLeft = rect.left + (box.left - padX) * scaleX;
    const unclampedTop = rect.top + (box.top - padY) * scaleY;
    Object.assign(region.style, {
      left: `${Math.max(rect.left, Math.min(unclampedLeft, rect.right - boxWidth))}px`,
      top: `${Math.max(rect.top, Math.min(unclampedTop, rect.bottom - boxHeight))}px`,
      width: `${boxWidth}px`,
      height: `${boxHeight}px`,
      fontSize: `${fit.size}px`,
      lineHeight: `${fit.lineHeight}px`
    });
    region.textContent = fit.text;
    state.node.append(region);
  }
}

function render() {
  if (!enabled) return;
  for (const state of overlays.values()) renderState(state);
  const close = root().querySelector<HTMLButtonElement>('.manga-tr-close');
  if (close) Object.assign(close.style, { left: `${Math.max(8, innerWidth - 44)}px`, top: '10px' });
}

function scheduleRender() {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(render);
}

function filterEnglishOcrBoxes(boxes: OcrBox[]): OcrBox[] {
  return boxes.filter((box) => {
    const text = String(box.text ?? '').trim();
    const confidence = Number(box.confidence);
    const isAsciiWord = /^[A-Za-z0-9\s.,!?;:'"()\-]+$/.test(text);
    const isLongEnough = text.length >= 2;
    const hasReliableConfidence = Number.isFinite(confidence) && confidence >= 50;
    const hasRepeatedLetter = /(.)\1\1\1/i.test(text);
    if (!isAsciiWord || !isLongEnough || !hasReliableConfidence || hasRepeatedLetter) {
      console.warn('[MangaTR OCR FILTERED]', text, confidence);
      return false;
    }
    return true;
  });
}

async function processImage(image: HTMLImageElement, state: OverlayState) {
  if (state.busy || !enabled) return;
  state.queued = false;
  state.busy = true;
  try {
    status(`Yerel OCR çalışıyor: ${overlays.size - ocrQueue.length} / ${overlays.size} görsel`);
    const key = imageCacheKey(image);
    const rawBoxes = filterEnglishOcrBoxes(ocrCache.get(key) ?? await recognizeImageLocally(image));
    ocrCache.set(key, rawBoxes);
    if (!rawBoxes.length) throw new Error('Bu görselde güvenilir İngilizce metin bulunamadı.');
    status(`DeepL çeviriyor: ${rawBoxes.length} metin bölgesi`);
    state.boxes = await translateBoxes(rawBoxes);
    renderState(state);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error('OCR/çeviri başarısız:', error);
    status(`Bu görsel işlenemedi: ${detail}`);
  } finally {
    state.busy = false;
    state.processed = true;
    queueRunning = false;
    pumpQueue();
  }
}

function pumpQueue() {
  if (!enabled || queueRunning) return;
  const next = ocrQueue.shift();
  if (next) {
    queueRunning = true;
    void processImage(next.image, next);
  }
}
}
/* AGENT_GOREV1_BİTİŞ */

function queueVisibleImages() {
  if (captureScrollLock) return;
  for (const state of overlays.values()) {
    if (!state.busy && !state.queued && !state.processed && isNearViewport(state.image)) {
      state.queued = true;
      ocrQueue.push(state);
    }
  }
  pumpQueue();
}

function ensureOverlays() {
  const container = root();
  for (const image of Array.from(document.images)) {
    if (!isMangaImage(image) || overlays.has(image)) continue;
    const node = document.createElement('div');
    const state: OverlayState = { image, boxes: [], node, busy: false, queued: false, processed: false };
    overlays.set(image, state);
    container.append(node);
  }
  queueVisibleImages();
  for (const [image, state] of overlays) {
    if (isMangaImage(image)) continue;
    state.node.remove();
    overlays.delete(image);
  }
}

function startPageTranslation() {
  clearOverlays();
  enabled = true;
  addStyle();
  ensureOverlays();
  controller = new AbortController();
  window.addEventListener('resize', scheduleRender, { passive: true, signal: controller.signal });
  window.addEventListener('scroll', scheduleRender, { passive: true, capture: true, signal: controller.signal });
  window.addEventListener('scroll', queueVisibleImages, { passive: true, capture: true, signal: controller.signal });
  document.addEventListener('load', scheduleRender, { capture: true, signal: controller.signal });
  pageObserver = new MutationObserver(() => { ensureOverlays(); scheduleRender(); });
  pageObserver.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['src', 'srcset', 'style', 'class', 'width', 'height'] });
  render();
}

function clearOverlays() {
  enabled = false;
  cancelAnimationFrame(frame);
  controller?.abort();
  controller = null;
  pageObserver?.disconnect();
  pageObserver = null;
  ocrQueue.length = 0;
  queueRunning = false;
  captureScrollLock = false;
  for (const pending of pendingOcr.values()) pending.reject(new Error('OCR iptal edildi.'));
  pendingOcr.clear();
  document.querySelector<HTMLIFrameElement>('iframe[src$="/ocr-frame.html"]')?.remove();
  ocrFramePromise = null;
  for (const state of overlays.values()) state.node.remove();
  overlays.clear();
  document.getElementById(ROOT_ID)?.remove();
}

api.runtime.onMessage.addListener((message: ExtensionMessage) => {
  if (message.type === 'START_PAGE_TRANSLATION') startPageTranslation();
  if (message.type === 'CLEAR_OVERLAY') clearOverlays();
});
}


```
