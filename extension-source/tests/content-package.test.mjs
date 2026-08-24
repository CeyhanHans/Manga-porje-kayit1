import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

test('distributed content script contains and executes the shared geometry implementation', async () => {
  const script = await readFile(new URL('../dist/chromium/content.js', import.meta.url), 'utf8');
  const match = script.match(/\/\* MANGA_TR_GEOMETRY_START \*\/([\s\S]*?)\/\* MANGA_TR_GEOMETRY_END \*\//);
  assert.ok(match, 'geometry prelude must be embedded in the distributed content script');
  const sandbox = {}; sandbox.globalThis = sandbox;
  vm.runInNewContext(match[1], sandbox);
  const rendered = sandbox.MangaTrGeometry.contentRect({ left: 0, top: 0, width: 300, height: 300 }, { width: 100, height: 200 }, 'contain');
  assert.deepEqual({ ...rendered }, { left: 75, top: 0, width: 150, height: 300 });
});

test('distributed content script supports automatic page-wide image overlays', async () => {
  const script = await readFile(new URL('../dist/chromium/content.js', import.meta.url), 'utf8');
  assert.match(script, /START_PAGE_TRANSLATION/);
  assert.match(script, /Array\.from\(document\.images\)/);
  assert.match(script, /MutationObserver/);
  assert.match(script, /TRANSLATE_TEXTS/);
  assert.match(script, /translationCache/);
  assert.match(script, /data:image\//);
  assert.match(script, /blob:/);
  assert.match(script, /MANGA_TR_CAPTURE_START/);
  assert.match(script, /CAPTURE_VISIBLE_TAB/);
  assert.match(script, /recognizeScrolledScreenshot/);
  assert.match(script, /behavior:\s*['"]instant['"]/);
  assert.match(script, /Tam görsel ekran yakalama/);
  assert.match(script, /MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND/);
  assert.match(script, /candidateBottom > naturalY/);
  assert.match(script, /function extensionOrigin/);
  assert.doesNotMatch(script, /new URL\(extensionUrl\(''\)\)\.origin/);
  assert.match(script, /queueRunning/);
  assert.match(script, /captureScrollLock/);
  assert.match(script, /frame\.onload = ready/);
});

test('distributed background forwards the page referrer for protected image hosts', async () => {
  const script = await readFile(new URL('../dist/chromium/background.js', import.meta.url), 'utf8');
  assert.match(script, /sender\?\.tab\?\.url/);
  assert.match(script, /referrerPolicy/);
  assert.match(script, /credentials:\s*['"]omit['"]/);
  assert.match(script, /cache:\s*['"]no-store['"]/);
  assert.match(script, /header:\s*['"]Origin['"],\s*operation:\s*['"]remove['"]/);
  assert.match(script, /updateSessionRules/);
  assert.match(script, /captureVisibleTab/);
});

test('distributed Firefox background rewrites protected image request headers', async () => {
  const script = await readFile(new URL('../dist/firefox/background.js', import.meta.url), 'utf8');
  assert.match(script, /webRequest\.onBeforeSendHeaders/);
  assert.match(script, /webRequestBlocking|requestHeaders/);
  assert.match(script, /name:\s*['"]Referer['"]/);
  assert.match(script, /name !== ['"]origin['"]/);
  assert.match(script, /credentials:\s*['"]omit['"]/);
  assert.match(script, /captureVisibleTab/);
});

test('distributed Firefox package declares remote data use and avoids unsafe eval fallbacks', async () => {
  const manifest = JSON.parse(await readFile(new URL('../dist/firefox/manifest.json', import.meta.url), 'utf8'));
  assert.deepEqual(
    manifest.browser_specific_settings?.gecko?.data_collection_permissions?.required,
    ['authenticationInfo', 'websiteContent']
  );
  const scripts = await Promise.all(
    ['ocr.js', 'ocr-frame.js', 'ocr-worker.min.js'].map((file) => readFile(new URL(`../dist/firefox/${file}`, import.meta.url), 'utf8'))
  );
  assert.doesNotMatch(scripts.join('\n'), /new Function\(|Function\(["']r["']/);
});

