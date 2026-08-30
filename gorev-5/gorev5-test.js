// GÖREV 5 testleri — cache davranışlarını gerçek dosyadan çıkarıp doğrular.
const fs = require('fs');
const src = fs.readFileSync('C:/Users/user/Desktop/chromium/content.js', 'utf8');

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

// Kaynak yapısal kontrolleri
check('S1 getCachedOcr/setCachedOcr global blokta tanimli',
    /\/\* AGENT_GOREV5_BAŞLANGIÇ \*\/[\s\S]*?function getCachedOcr/.test(src) &&
    src.indexOf('function getCachedOcr') < src.indexOf('"use strict"'));
check('S2 eski ocrCache tamamen kaldirildi', !/const ocrCache = new Map/.test(src) && !/ocrCache\.(get|set)/.test(src));
check('S3 processImage getCachedOcr kullaniyor', /const cached = getCachedOcr\(key\);/.test(src) && /if \(!cached\)\s*\n?\s*setCachedOcr\(key, rawBoxes\);/.test(src));
check('S4 dataset.mangaTrOverlayDone isareti render sonrasi', src.indexOf("state.image.dataset.mangaTrOverlayDone = '1'") > src.indexOf('renderState(state);'));
check('S5 queueImage dataset kontrolu', /image\.dataset\.mangaTrOverlayDone === '1'/.test(src));
check('S6 clearOverlays dataset temizligi', /delete image\.dataset\.mangaTrOverlayDone;/.test(src));
check('S7 TTL 5 dakika sabiti', /OCR_CACHE_TTL_MS = 5 \* 60 \* 1000/.test(src));
check('S8 MAX_SIZE 50 sabiti', /OCR_CACHE_MAX_SIZE = 50/.test(src));
check('S9 data: URL engeli', /url\.startsWith\('data:image\/'\)/.test(src));
check('S10 HIT log formati', /console\.log\('\[MangaTR CACHE HIT\]', url\)/.test(src));
check('S11 GOREV4/2/3 bloklarina dokunulmadi', src.includes('AGENT_4_BAŞLANGIÇ') && src.includes('AGENT_2_BAŞLANGIÇ') && src.includes('AGENT_GOREV3_BAŞLANGIÇ'));

// Davranış testleri: cache bloğunu global sarmalayıcıda çalıştır
const cacheBlock = extract(src, 'const MangaTrOcrCache = new Map()', '/* AGENT_GOREV5_BİTİŞ */');
const makeCache = (consoleRef) => new Function('console', cacheBlock + '\nreturn { MangaTrOcrCache, getCachedOcr, setCachedOcr };')(consoleRef);
let g = makeCache(console);
const { getCachedOcr, setCachedOcr, MangaTrOcrCache } = g;

// T1: set → get hit + log
setCachedOcr('https://ornek.com/sayfa1.jpg|800x1200', [{ text: 'HELLO' }]);
const hit1 = getCachedOcr('https://ornek.com/sayfa1.jpg|800x1200');
check('T1 cache hit ayni kutular dondu', Array.isArray(hit1) && hit1[0].text === 'HELLO');

// T2: olmayan anahtar
check('T2 olmayan anahtar null', getCachedOcr('https://yok.com/a.jpg|1x1') === null);

// T3: data: URL cache'lenmez
setCachedOcr('data:image/png;base64,AAAA|800x1200', [{ text: 'X' }]);
check('T3 data: URL cache lenmedi', getCachedOcr('data:image/png;base64,AAAA|800x1200') === null && !MangaTrOcrCache.has('data:image/png;base64,AAAA|800x1200'));

// T4: TTL asimi — 6 dk eski entry null donmeli
MangaTrOcrCache.set('https://eski.com/b.jpg|2x2', { regions: [{ text: 'ESKI' }], timestamp: Date.now() - (6 * 60 * 1000 + 1000) });
check('T4 6dk eski entry TTL asimi -> null', getCachedOcr('https://eski.com/b.jpg|2x2') === null);

// T5: TTL icinde — 4 dk eski entry donmeli
MangaTrOcrCache.set('https://taze.com/c.jpg|3x3', { regions: [{ text: 'TAZE' }], timestamp: Date.now() - 4 * 60 * 1000 });
check('T5 4dk eski entry hala gecerli', getCachedOcr('https://taze.com/c.jpg|3x3')[0].text === 'TAZE');

// T6: MAX 50 — 51. ekleme en eskisini (ilk gireni) atmali
for (let i = 0; i < 60; i++) setCachedOcr(`https://sayfa-${i}.com/x.jpg|1x1`, [{ text: String(i) }]);
check('T6 boyut siniri 50', MangaTrOcrCache.size === 50, 'boyut=' + MangaTrOcrCache.size);
check('T7 LRU-vari atim: ilk girilen atildi', !MangaTrOcrCache.has('https://sayfa-0.com/x.jpg|1x1') && MangaTrOcrCache.has('https://sayfa-59.com/x.jpg|1x1'));

// T8: HIT logu
const logs = [];
const logConsole = { log: (...a) => logs.push(a.join(' ')) };
const g8 = makeCache(logConsole);
g8.setCachedOcr('https://logtest.com/z.jpg|9x9', [{ text: 'L' }]);
g8.getCachedOcr('https://logtest.com/z.jpg|9x9');
check('T8 [MangaTR CACHE HIT] loglandi', logs.some(l => l.includes('[MangaTR CACHE HIT]')), JSON.stringify(logs));

// T9: TTL asiminda log YOK (sessiz miss)
logs.length = 0;
const g9 = makeCache(logConsole);
g9.MangaTrOcrCache.set('https://log2.com/y.jpg|1x1', { regions: [], timestamp: Date.now() - 6 * 60 * 1000 });
g9.getCachedOcr('https://log2.com/y.jpg|1x1');
check('T9 TTL miss log uretmedi', logs.length === 0, JSON.stringify(logs));

console.log(`\nSONUC: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
