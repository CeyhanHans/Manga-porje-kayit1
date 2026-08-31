/* DUZELTME_GOREV3: görünür build kimliği doğrulamaları — dist çıktısı üzerinde çalışır. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const buildIdPattern = /^[0-9a-f]{7,40}\.\d{8}T\d{6}-\d{3}Z$|^nogit\.\d{8}T\d{6}-\d{3}Z$/;

test('dist targets carry a build-info.json with a valid build identity', async () => {
  const identities = [];
  for (const target of ['chromium', 'firefox']) {
    const info = JSON.parse(await readFile(new URL(`../dist/${target}/build-info.json`, import.meta.url), 'utf8'));
    assert.equal(info.schema, 'manga-tr-build-info/1', `${target}: schema sabit olmalı`);
    assert.match(info.buildId, buildIdPattern, `${target}: buildId = <commit>.<UTC zaman> biçiminde olmalı`);
    assert.ok(info.buildId.startsWith(`${info.commit}.`), `${target}: buildId commit önekiyle başlamalı`);
    assert.ok(!Number.isNaN(Date.parse(info.builtAtUtc)), `${target}: builtAtUtc geçerli ISO tarih olmalı`);
    identities.push(info.buildId);
  }
  assert.equal(identities[0], identities[1], 'chromium ve firefox aynı buildId taşımalı');
});

test('chromium manifest version_name matches build-info and popup renders the build id', async () => {
  const manifest = JSON.parse(await readFile(new URL('../dist/chromium/manifest.json', import.meta.url), 'utf8'));
  const info = JSON.parse(await readFile(new URL('../dist/chromium/build-info.json', import.meta.url), 'utf8'));
  assert.equal(manifest.version_name, `${manifest.version}+${info.buildId}`, 'chrome://extensions kartındaki kimlik disk ile eşleşmeli');

  const popupHtml = await readFile(new URL('../dist/chromium/popup.html', import.meta.url), 'utf8');
  assert.match(popupHtml, /id="build"/, 'popup build kimliği satırını içermeli');
  const popupJs = await readFile(new URL('../dist/chromium/popup.js', import.meta.url), 'utf8');
  assert.match(popupJs, /build-info\.json/, 'popup.js build kimliğini build-info.json’dan okumalı');
  assert.match(popupJs, /Build:/, 'popup.js build kimliğini kullanıcıya göstermeli');
});

test('firefox manifest stays untouched and verify-build hash table exists', async () => {
  const manifest = JSON.parse(await readFile(new URL('../dist/firefox/manifest.json', import.meta.url), 'utf8'));
  assert.equal(manifest.version_name, undefined, 'version_name Chrome’a özgüdür; firefox manifestinde olmamalı');
  const hashes = await readFile(new URL('../outputs/build-hashes.txt', import.meta.url), 'utf8');
  assert.match(hashes, /chromium\/content\.js\s+[0-9a-f]{64}/, 'hash tablosu chromium dosyalarını içermeli');
  assert.match(hashes, /Build ID:/, 'hash tablosu build kimliğini kaydetmeli');
});
