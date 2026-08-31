import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { build as bundle } from 'esbuild';
import ts from 'typescript';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const dist = new URL('../dist/', import.meta.url);

/* DUZELTME_GOREV3_BAŞLANGIÇ: görünür build kimliği (commit kısa SHA + UTC zaman).
   Kimlik gizli veri içermez; build-info.json'a, chromium manifest version_name alanına
   yazılır ve popup'da gösterilir. Git bulunamazsa 'nogit' işaretiyle üretilir. */
function shortCommit() {
  try { return execSync('git rev-parse --short HEAD', { cwd: fileURLToPath(new URL('../', import.meta.url)), stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || 'nogit'; }
  catch { return 'nogit'; }
}
const builtAtUtc = new Date().toISOString();
const buildStamp = builtAtUtc.replaceAll(/[-:]/g, '').replaceAll('.', '-');
const buildId = `${shortCommit()}.${buildStamp}`;
/* DUZELTME_GOREV3_BİTİŞ */

await rm(dist, { recursive: true, force: true });
const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const configPath = fileURLToPath(new URL('../tsconfig.json', import.meta.url));
const config = ts.readConfigFile(configPath, ts.sys.readFile);
if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, projectRoot);
const program = ts.createProgram(parsed.fileNames, parsed.options);
const diagnostics = ts.getPreEmitDiagnostics(program).concat(program.emit().diagnostics);
if (diagnostics.length) {
  throw new Error(ts.formatDiagnosticsWithColorAndContext(diagnostics, { getCanonicalFileName: (file) => file, getCurrentDirectory: () => projectRoot, getNewLine: () => '\n' }));
}

const targets = [
  ['chromium', 'manifest.chromium.json'],
  ['firefox', 'manifest.firefox.json']
];
const geometrySource = await readFile(new URL('../build/src/shared/geometry.js', import.meta.url), 'utf8');
const geometryPrelude = `/* MANGA_TR_GEOMETRY_START */\n${geometrySource.replaceAll('export ', '')}\nglobalThis.MangaTrGeometry = { contentRect, polygonBounds, mapSourceRect };\n/* MANGA_TR_GEOMETRY_END */\n`;
const captureSource = await readFile(new URL('../build/src/shared/capture-mapping.js', import.meta.url), 'utf8');
const capturePrelude = `/* MANGA_TR_CAPTURE_START */\n${captureSource.replaceAll('export ', '')}\nglobalThis.MangaTrCapture = { computeVisibleImageCrop };\n/* MANGA_TR_CAPTURE_END */\n`;
/* DUZELTME_GOREV4_BAŞLANGIÇ: sonuç sınıflandırma modülü content script'e prelud olarak enjekte
   edilir (content script klasik script — import kullanamaz; Geometry/Capture ile aynı desen). */
const runStatsSource = await readFile(new URL('../build/src/shared/run-stats.js', import.meta.url), 'utf8');
const runStatsPrelude = `/* MANGA_TR_RUN_STATS_START */\n${runStatsSource.replaceAll('export ', '')}\nglobalThis.MangaTrRunStats = { createRunStats, classifyNoTextOutcome, classifyTechnicalError, recordOutcome, doneTotal, isConsistent, snapshotOf, formatStatsLine, TECHNICAL_CODES };\n/* MANGA_TR_RUN_STATS_END */\n`;
/* DUZELTME_GOREV4_BİTİŞ */
/* DUZELTME_GOREV5_BAŞLANGIÇ: run yaşam döngüsü modülü aynı mekanizmayla enjekte edilir. */
const runLifecycleSource = await readFile(new URL('../build/src/shared/run-lifecycle.js', import.meta.url), 'utf8');
const runLifecyclePrelude = `/* MANGA_TR_RUN_LIFECYCLE_START */\n${runLifecycleSource.replaceAll('export ', '')}\nglobalThis.MangaTrRunLifecycle = { createRunState, subscribe, startWork, cancel, finishWork, finishCancelled };\n/* MANGA_TR_RUN_LIFECYCLE_END */\n`;
/* DUZELTME_GOREV5_BİTİŞ */

async function patchFirefoxCspCompatibility(targetDir) {
  for (const file of ['ocr.js', 'ocr-frame.js']) {
    const url = new URL(file, targetDir);
    const source = await readFile(url, 'utf8');
    const unsafeFallback = 'Function("r", "regeneratorRuntime = r")(runtime);';
    if (!source.includes(unsafeFallback)) throw new Error(`${file}: expected regenerator fallback was not found`);
    await writeFile(url, source.replaceAll(unsafeFallback, 'globalThis.regeneratorRuntime = runtime;'));
  }

  const workerUrl = new URL('ocr-worker.min.js', targetDir);
  let worker = await readFile(workerUrl, 'utf8');
  const replacements = [
    ['Function("r","regeneratorRuntime = r")(i)', 'globalThis.regeneratorRuntime=i'],
    [
      'r.g=function(){if("object"==typeof globalThis)return globalThis;try{return this||new Function("return this")()}catch(t){if("object"==typeof window)return window}}()',
      'r.g=function(){if("object"==typeof globalThis)return globalThis;if("object"==typeof self)return self;if("object"==typeof window)return window;return{}}()'
    ]
  ];
  for (const [unsafeFallback, safeFallback] of replacements) {
    if (!worker.includes(unsafeFallback)) throw new Error(`ocr-worker.min.js: expected CSP fallback was not found: ${unsafeFallback}`);
    worker = worker.replaceAll(unsafeFallback, safeFallback);
  }
  await writeFile(workerUrl, worker);
}

for (const [target, manifest] of targets) {
  const targetDir = new URL(`../dist/${target}/`, import.meta.url);
  await mkdir(targetDir, { recursive: true });
  await cp(new URL(`../build/src/background/background.${target}.js`, import.meta.url), new URL('background.js', targetDir));
  await bundle({ entryPoints: [fileURLToPath(new URL('../build/src/ocr/ocr.js', import.meta.url))], bundle: true, format: 'esm', platform: 'browser', outfile: fileURLToPath(new URL('ocr.js', targetDir)) });
  await bundle({ entryPoints: [fileURLToPath(new URL('../build/src/ocr/ocr-frame.js', import.meta.url))], bundle: true, format: 'esm', platform: 'browser', outfile: fileURLToPath(new URL('ocr-frame.js', targetDir)) });
  await cp(new URL('../src/ocr/ocr-frame.html', import.meta.url), new URL('ocr-frame.html', targetDir));
  await cp(new URL('../node_modules/tesseract.js/dist/worker.min.js', import.meta.url), new URL('ocr-worker.min.js', targetDir));
  const coreDir = new URL('ocr-core/', targetDir);
  const langDir = new URL('ocr-lang/', targetDir);
  await mkdir(coreDir, { recursive: true });
  await mkdir(langDir, { recursive: true });
  for (const file of ['tesseract-core.js', 'tesseract-core.wasm', 'tesseract-core.wasm.js', 'tesseract-core-simd.js', 'tesseract-core-simd.wasm', 'tesseract-core-simd.wasm.js', 'tesseract-core-lstm.js', 'tesseract-core-lstm.wasm', 'tesseract-core-lstm.wasm.js', 'tesseract-core-simd-lstm.js', 'tesseract-core-simd-lstm.wasm', 'tesseract-core-simd-lstm.wasm.js']) {
    await cp(new URL(`../node_modules/tesseract.js-core/${file}`, import.meta.url), new URL(file, coreDir));
  }
  await cp(new URL('../assets/ocr/eng.traineddata.gz', import.meta.url), new URL('eng.traineddata.gz', langDir));
  const contentSource = await readFile(new URL('../build/src/content/content.js', import.meta.url), 'utf8');
  await writeFile(new URL('content.js', targetDir), geometryPrelude + capturePrelude + runStatsPrelude + runLifecyclePrelude + contentSource);
  await cp(new URL('../build/src/popup/popup.js', import.meta.url), new URL('popup.js', targetDir));
  await cp(new URL('../src/popup/popup.html', import.meta.url), new URL('popup.html', targetDir));
  /* DUZELTME_GOREV3_BAŞLANGIÇ: her build hedefine build-info.json yaz; chromium manifest'ına
     version_name olarak da işle (chrome://extensions kartında görünür). Firefox manifest
     dokunulmaz (version_name Chrome'a özgü anahtardır). */
  await writeFile(new URL('build-info.json', targetDir), `${JSON.stringify({ schema: 'manga-tr-build-info/1', buildId, commit: shortCommit(), builtAtUtc }, null, 2)}\n`);
  const manifestPayload = JSON.parse(await readFile(new URL(`../src/manifest/${manifest}`, import.meta.url), 'utf8'));
  if (target === 'chromium') manifestPayload.version_name = `${manifestPayload.version}+${buildId}`;
  await writeFile(new URL('manifest.json', targetDir), `${JSON.stringify(manifestPayload, null, 2)}\n`);
  /* DUZELTME_GOREV3_BİTİŞ */
  await writeFile(new URL('README.txt', targetDir), `Load this folder as an unpacked ${target} extension. Local English OCR is bundled. Turkish translation uses the DeepL API key stored in the browser's local extension storage.\n`);
  if (target === 'firefox') await patchFirefoxCspCompatibility(targetDir);
}

console.log(`Built dist/chromium and dist/firefox`);
/* DUZELTME_GOREV3_BAŞLANGIÇ */
console.log(`Build ID: ${buildId} (commit ${shortCommit()}, UTC ${builtAtUtc})`);

// Build sonu: gerekli dosyaların varlığını doğrula, sha256 hash tablosunu yaz.
const digest = (content) => createHash('sha256').update(content).digest('hex');
const hashLines = [];
for (const [target] of targets) {
  const targetDir = new URL(`../dist/${target}/`, import.meta.url);
  const entries = (await readdir(targetDir)).sort();
  for (const file of ['README.txt', 'background.js', 'build-info.json', 'content.js', 'manifest.json', 'ocr-frame.html', 'ocr-frame.js', 'ocr-worker.min.js', 'ocr.js', 'popup.html', 'popup.js']) {
    if (!entries.includes(file)) throw new Error(`${target}: build çıktısında ${file} eksik`);
    hashLines.push(`${target}/${file}  ${digest(await readFile(new URL(file, targetDir)))}`);
  }
  for (const directory of ['ocr-core', 'ocr-lang']) {
    if (!entries.includes(directory)) throw new Error(`${target}: build çıktısında ${directory}/ eksik`);
    const dirEntries = (await readdir(new URL(`${directory}/`, targetDir))).sort();
    hashLines.push(`${target}/${directory}/  (${dirEntries.length} dosya) ${digest(Buffer.from(dirEntries.join('\n')))}`);
  }
  hashLines.push('');
}
await mkdir(new URL('../outputs/', import.meta.url), { recursive: true });
await writeFile(new URL('build-hashes.txt', new URL('../outputs/', import.meta.url)), `Manga Türkçe Overlay — dist hash tablosu (sha256)\nBuild ID: ${buildId}\nUTC: ${builtAtUtc}\n\n${hashLines.join('\n')}\n`);
console.log(`Hash tablosu: ${fileURLToPath(new URL('../outputs/build-hashes.txt', import.meta.url))}`);
/* DUZELTME_GOREV3_BİTİŞ */

