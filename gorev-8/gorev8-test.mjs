// GÖREV 8 testleri — translateTexts'i mock chrome+fetch ile doğrular (gerçek dosyadan çıkarır).
import fs from 'node:fs';
const src = fs.readFileSync('C:/Users/user/Desktop/chromium/background.js', 'utf8');

function extract(source, startMarker, endMarker) {
    const start = source.indexOf(startMarker);
    const end = source.indexOf(endMarker, start);
    if (start < 0 || end < 0) throw new Error('blok bulunamadi: ' + startMarker);
    return source.slice(start, end);
}

let pass = 0, fail = 0;
function check(name, cond, detail) {
    if (cond) { pass++; console.log('PASS', name); }
    else { fail++; console.log('FAIL', name, '|', detail ?? ''); }
}

// Kaynak yapı kontrolleri
check('S1 dedup (new Set) mevcut', /\[\.\.\.new Set\(cleanTexts\)\]/.test(src));
check('S2 karakter logu mevcut', src.includes('[MangaTR DeepL] ${totalChars} karakter gönderildi.'));
check('S3 endpoint degismedi', src.includes("'https://api-free.deepl.com/v2/translate'"));
check('S4 auth bicimi degismedi', /DeepL-Auth-Key \$\{key\}/.test(src));
check('S5 donus girdi sirasina gore aciliyor', /cleanTexts\.map\(\(text\) => translationMap\[text\] \?\? ''\)/.test(src));
check('S6 AGENT_GOREV8 isaretleri', src.includes('AGENT_GOREV8_BAŞLANGIÇ') && src.includes('AGENT_GOREV8_BİTİŞ'));
check('S7 GOREV7 hata mesajlari korundu', src.includes('456') && src.includes('aylık karakter kotanız doldu'));
check('S8 GOREV2 fallback blogu korundu', src.includes("'to be': 'olmak için'") && src.includes('AGENT_2_BAŞLANGIÇ'));

// Davranış testleri: fallback blogu + translateTexts, mock chrome/fetch ile
const fallbackBlock = extract(src, '/* MANGA_TR_TRANSLATION_FALLBACK_START', '/* MANGA_TR_TRANSLATION_FALLBACK_END */');
const fnBlock = extract(src, 'async function translateTexts', '/* AGENT_GOREV8_BİTİŞ */');

function makeHarness(payloadFn, status = 200) {
    const calls = [];
    const logs = [];
    // fonksiyon tanimini kur: mock chrome/fetch/console + gercek fallback API ile
    // (AGENT_GOREV8_BİTİŞ isareti fonksiyon kapanisindan once oldugu icin kapanis burada tamamlanir;
    //  DEEPL_ENDPOINT IIFE sabiti oldugundan gercek degeri parametre olarak verilir)
    const DEEPL_ENDPOINT = 'https://api-free.deepl.com/v2/translate';
    const factory = new Function('chrome', 'fetch', 'console', 'MangaTrTranslationFallback', 'DEEPL_ENDPOINT',
        fnBlock + '\n}\nreturn translateTexts;');
    const chromeMock = { storage: { local: { get: async () => ({ deeplApiKey: 'TEST-KEY:fx' }) } } };
    const fetchMock = async (url, init) => {
        calls.push({ url, body: JSON.parse(init.body) });
        return { ok: status >= 200 && status < 300, status, json: async () => payloadFn(calls[calls.length - 1]) };
    };
    const consoleMock = { log: (...a) => logs.push(a.join(' ')) };
    // MangaTrTranslationFallback mock'u: gercek fallback blogundan uret
    const fallbackFactory = new Function('globalThis', fallbackBlock + '\nreturn globalThis.MangaTrTranslationFallback;');
    const sandbox = {};
    const fallbackApi = fallbackFactory(sandbox);
    const translateTexts = factory(chromeMock, fetchMock, consoleMock, fallbackApi, DEEPL_ENDPOINT);
    return { translateTexts, calls, logs };
}

// T1: tekrarlar tek sefer gonderilir + donus sirasi dogru
{
    const h = makeHarness(call => ({
        translations: call.body.text.map(t => ({ text: 'TR[' + t + ']' }))
    }));
    const r = await h.translateTexts(['HELLO', 'WORLD', 'HELLO', 'HELLO', 'WORLD', '  BYE  '], undefined);
    check('T1 DeepL 3 benzersiz metin aldi (5 tekrar + 1 yeni)', h.calls.length === 1 && h.calls[0].body.text.length === 3 && JSON.stringify(h.calls[0].body.text) === JSON.stringify(['HELLO', 'WORLD', 'BYE']), JSON.stringify(h.calls?.[0]?.body));
    check('T2 donus 6 eleman ve sira dogru', r.translations.length === 6 &&
        r.translations[0] === 'TR[HELLO]' && r.translations[1] === 'TR[WORLD]' && r.translations[2] === 'TR[HELLO]' &&
        r.translations[3] === 'TR[HELLO]' && r.translations[4] === 'TR[WORLD]' && r.translations[5] === 'TR[BYE]', JSON.stringify(r.translations));
    check('T3 karakter logu = benzersiz toplam (5+5+3=13)', h.logs.some(l => l.includes('[MangaTR DeepL] 13 karakter gönderildi.')), JSON.stringify(h.logs));
}

// T2: 55 benzersiz metin -> 50 gider, 55 doner, HATA yok, son 5 bos
{
    const texts = Array.from({ length: 55 }, (_, i) => 'TEXT-' + i);
    const h = makeHarness(call => ({ translations: call.body.text.map(t => ({ text: 'TR[' + t + ']' })) }));
    const r = await h.translateTexts(texts, undefined);
    check('T4 50 metin siniri: fetch 50 aldi', h.calls[0].body.text.length === 50);
    check('T5 donus 55 (hata yok, esnek davranis)', r.translations.length === 55);
    check('T6 ilk 50 cevrildi son 5 bos', r.translations[49] === 'TR[TEXT-49]' && r.translations[50] === '' && r.translations[54] === '');
}

// T3: fallback entegrasyonu — 'TO BE' aynen donerse sozlukten duzeltir
{
    const h = makeHarness(call => ({ translations: call.body.text.map(t => ({ text: t })) }));
    const r = await h.translateTexts(['TO BE', 'REAL SENTENCE'], undefined);
    check('T7 fallback: TO BE -> olmak için', r.translations[0] === 'olmak için', JSON.stringify(r.translations));
    check('T8 gercek ceviri degistirilmedi', r.translations[1] === 'REAL SENTENCE');
}

// T4: bos/temizlenmis girdi -> fetch hic cagrilmaz (boslar filter(Boolean) ile elenir)
{
    const h = makeHarness(() => ({ translations: [] }));
    const r = await h.translateTexts(['', '   ', ''], undefined);
    check('T9 bos girdi fetch cagrilmadi, bos dondu', h.calls.length === 0 && r.translations.length === 0, 'calls=' + h.calls.length + ' len=' + r.translations.length);
}

// T5: 456 hata mesaji (GOREV7) hala firlatiliyor
{
    const h = makeHarness(() => ({}), 456);
    let err = null;
    try { await h.translateTexts(['X'], undefined); } catch (e) { err = e.message; }
    check('T10 456 kotas hatasi korundu', err === 'DeepL aylık karakter kotanız doldu. Yeni ay başında sıfırlanır.', String(err));
}

// T6: eksik DeepL yaniti hala hata verir
{
    const h = makeHarness(() => ({ translations: [{ text: 'TEK' }] }));
    let err = null;
    try { await h.translateTexts(['A', 'B'], undefined); } catch (e) { err = e.message; }
    check('T11 eksik ceviri hatasi korundu', err === 'DeepL eksik çeviri sonucu döndürdü.', String(err));
}

console.log(`\nSONUC: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
