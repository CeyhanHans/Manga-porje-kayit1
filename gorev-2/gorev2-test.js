// GÖREV 2 mantık testleri — gerçek dosyalardan fonksiyon bloklarını çıkarıp çalıştırır.
const fs = require('fs');

const contentSrc = fs.readFileSync('C:/Users/user/Desktop/chromium/content.js', 'utf8');
const backgroundSrc = fs.readFileSync('C:/Users/user/Desktop/chromium/background.js', 'utf8');

function extract(source, startMarker, endMarker) {
    const start = source.indexOf(startMarker);
    const end = source.indexOf(endMarker, start);
    if (start < 0 || end < 0) throw new Error('blok bulunamadi: ' + startMarker);
    return source.slice(start, end);
}

// 1) mergeAdjacentBoxes (AGENT_2 bloğu) + yardımcılar
const mergeBlock = extract(contentSrc, 'function mergeAdjacentBoxes', '/* AGENT_2_BİTİŞ */');
// wrapText + wrapTextWithBreaks: TEXT_FIT bloğundan fonksiyonları al
const wrapBlock = extract(contentSrc, 'function finiteNumber(', 'function familyOrder(');
const wrapWithBreaks = extract(contentSrc, 'function wrapTextWithBreaks', '/* AGENT_2_BİTİŞ */');
const helpers = `
function visibleLength(text) { return Array.from(text).length; }
`;
const measureStub = ({ text, fontSize }) => text.length * fontSize * 0.55; // deterministik ölçüm

eval(helpers + wrapBlock + wrapWithBreaks + mergeBlock);

let pass = 0, fail = 0;
function check(name, cond, detail) {
    if (cond) { pass++; console.log('PASS', name); }
    else { fail++; console.log('FAIL', name, '|', detail ?? ''); }
}

// --- mergeAdjacentBoxes testleri ---
// A) Aynı balon: üstte "I FINALLY FOUND", hemen altında "TO BE CONTINUED..." (satır yüksekliği ~22, boşluk 8)
const boxA = { text: 'I FINALLY FOUND', confidence: 88, left: 100, top: 200, width: 220, height: 22, lineCount: 1 };
const boxB = { text: 'TO BE CONTINUED...', confidence: 72, left: 110, top: 230, width: 200, height: 22, lineCount: 1 };
const merged = mergeAdjacentBoxes([boxA, boxB]);
check('A1 aynı-balun satırları birleşti', merged.length === 1, 'kutu sayisi=' + merged.length);
check('A2 \\n ile birleşti', merged.length === 1 && merged[0].text === 'I FINALLY FOUND\nTO BE CONTINUED...', JSON.stringify(merged[0]?.text));
check('A3 lineCount toplandı', merged.length === 1 && merged[0].lineCount === 2);
check('A4 bbox birleşik', merged.length === 1 && merged[0].left === 100 && merged[0].top === 200 && merged[0].width === 220 && merged[0].height === 52);

// B) Farklı balonlar: dikeyde çok uzak (gap 300) → birleşmemeli
const boxC = { text: 'MEANWHILE', confidence: 90, left: 100, top: 600, width: 180, height: 24, lineCount: 1 };
const separate = mergeAdjacentBoxes([boxA, boxC]);
check('B1 uzak balonlar ayrı kaldı', separate.length === 2);

// B2) yatay örtüşme yok → birleşmemeli
const boxD = { text: 'SIDE NOTE', confidence: 90, left: 500, top: 205, width: 150, height: 22, lineCount: 1 };
const noOverlap = mergeAdjacentBoxes([boxA, boxD]);
check('B2 yatay örtüşmeyen birleşmedi', noOverlap.length === 2);

// C) zincirleme: 3 satırlı balon
const l1 = { text: 'THE', confidence: 90, left: 100, top: 100, width: 60, height: 20, lineCount: 1 };
const l2 = { text: 'ROOFTOP', confidence: 85, left: 100, top: 124, width: 120, height: 20, lineCount: 1 };
const l3 = { text: 'IS HIGH', confidence: 80, left: 100, top: 148, width: 100, height: 20, lineCount: 1 };
const chain = mergeAdjacentBoxes([l3, l1, l2]); // sırasız verilsin
check('C1 3 satır zincirleme tek balonda', chain.length === 1, 'kutu=' + chain.length);
check('C2 3 satır sırayla \\n', chain.length === 1 && chain[0].text === 'THE\nROOFTOP\nIS HIGH', JSON.stringify(chain[0]?.text));

// --- wrapTextWithBreaks testleri ---
const lines = wrapTextWithBreaks('MERHABA DÜNYA\nİKİNCİ SATIR UZUN OLSUN', 1000, 30, 'regular', 0, measureStub);
check('D1 \\n segmentleri ayrı satır bloklarında', lines[0] === 'MERHABA DÜNYA' && lines[1] === 'İKİNCİ SATIR UZUN OLSUN', JSON.stringify(lines));
const single = wrapTextWithBreaks('TEK SATIR METIN', 1000, 30, 'regular', 0, measureStub);
check('D2 \\n yoksa normal wrap', single[0] === 'TEK SATIR METIN', JSON.stringify(single));
const wrapped = wrapTextWithBreaks('KISA\nBU SATIR GERÇEKTEN ÇOK UZUN VE TAŞMASI GEREKİYOR', 220, 30, 'regular', 0, measureStub);
check('D3 dar alanda segment sonu satır sınırı', wrapped[0] === 'KISA' && wrapped.length > 2, JSON.stringify(wrapped));

// --- background fallback testleri ---
const fbStart = backgroundSrc.indexOf('/* MANGA_TR_TRANSLATION_FALLBACK_START');
const fbEnd = backgroundSrc.indexOf('/* MANGA_TR_TRANSLATION_FALLBACK_END');
if (fbStart < 0 || fbEnd < 0) throw new Error('fallback blogu bulunamadi');
const fbBlock = backgroundSrc.slice(fbStart, fbEnd);
const sandbox = {};
new Function('globalThis', fbBlock + '\n return globalThis.MangaTrTranslationFallback;').call(sandbox, sandbox);
const fb = sandbox.MangaTrTranslationFallback;
check('E1 "to be" fallback çevrildi', fb.repairUntranslatedText('TO BE', '') === 'olmak için');
check('E2 "to be" DeepL aynen dönerse düzeltildi', fb.repairUntranslatedText('to be', 'to be') === 'olmak için');
check('E3 "the rooftop" noktayla geldi', fb.repairUntranslatedText('THE ROOFTOP...', 'THE ROOFTOP...') === 'çatı katı');
check('E4 gerçek çeviri dokunulmadı', fb.repairUntranslatedText('wicked huh', 'Fena mı?') === 'Fena mı?');
check('E5 bilinmeyen kelime aynen', fb.repairUntranslatedText('xyzzy unknown', 'xyzzy unknown') === 'xyzzy unknown');
check('E6 eski sözlük korundu', fb.repairUntranslatedText('nope', '') === 'Hayır');

console.log(`\nSONUC: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
