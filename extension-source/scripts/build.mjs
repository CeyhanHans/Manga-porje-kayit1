import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { build as bundle } from 'esbuild';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';

const dist = new URL('../dist/', import.meta.url);

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
  await writeFile(new URL('content.js', targetDir), geometryPrelude + capturePrelude + contentSource);
  await cp(new URL('../build/src/popup/popup.js', import.meta.url), new URL('popup.js', targetDir));
  await cp(new URL('../src/popup/popup.html', import.meta.url), new URL('popup.html', targetDir));
  await cp(new URL(`../src/manifest/${manifest}`, import.meta.url), new URL('manifest.json', targetDir));
  await writeFile(new URL('README.txt', targetDir), `Load this folder as an unpacked ${target} extension. Local English OCR is bundled. Turkish translation uses the DeepL API key stored in the browser's local extension storage.\n`);
  if (target === 'firefox') await patchFirefoxCspCompatibility(targetDir);
}

console.log('Built dist/chromium and dist/firefox');

