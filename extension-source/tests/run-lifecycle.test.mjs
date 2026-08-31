/* DUZELTME_GOREV5: run yaşam döngüsü + 6 zorunlu senaryo + dist prelude testleri. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import {
  createRunState, subscribe, startWork, cancel, finishWork, finishCancelled, recordListener,
} from '../build/src/shared/run-lifecycle.js';

function setup(total) {
  const runId = 'run-test-001';
  const state = createRunState(runId, total);
  const records = [];
  subscribe(state, recordListener(records));
  return { runId, state, records };
}

test('Senaryo 1 — 0 görsel: completion tetiklenir, cancelled=false, ✓ mantığı', () => {
  const { state, records } = setup(0);
  // startPageTranslation sonrası doğrudan done=0
  const c = finishWork(state, 'run-test-001', 0, { translated: 0, skippedNoText: 0, filteredNoise: 0, untranslated: 0, failedTechnical: 0 }, 0);
  assert.ok(c, '0 görsel için completion bir kez üretilir');
  const completes = records.filter((message) => message.type === 'PROCESSING_COMPLETE');
  const progresses = records.filter((message) => message.type === 'PROCESSING_PROGRESS');
  assert.equal(completes.length, 1, 'completion tam bir kez');
  assert.equal(progresses.length, 1, '0 görsel için de progress bir kez');
  assert.equal(completes[0].cancelled, false);
  // popup ✓ göstermesi için cancelled=false && completed=true
});

test('Senaryo 2 — 1 başarılı görsel: 1 progress, 1 completion', () => {
  const { state, records } = setup(1);
  startWork(state, 'run-test-001');
  finishWork(state, 'run-test-001', 1, { translated: 1, skippedNoText: 0, filteredNoise: 0, untranslated: 0, failedTechnical: 0 }, 0);
  assert.equal(records.filter((m) => m.type === 'PROCESSING_PROGRESS').length, 1);
  assert.equal(records.filter((m) => m.type === 'PROCESSING_COMPLETE').length, 1);
  assert.equal(records.at(-1).cancelled, false);
});

test('Senaryo 3 — 10 karışık sonuç: sıra bağımsız, doğru sayaçlarla tamamlanır', () => {
  const counts = { translated: 5, skippedNoText: 2, filteredNoise: 1, untranslated: 1, failedTechnical: 1 };
  const { state, records } = setup(10);
  const order = ['translated', 'translated', 'skippedNoText', 'filteredNoise', 'failedTechnical', 'translated', 'untranslated', 'skippedNoText', 'translated', 'translated'];
  const doneCounts = { translated: 0, skippedNoText: 0, filteredNoise: 0, untranslated: 0, failedTechnical: 0 };
  for (let index = 0; index < 10; index += 1) {
    assert.ok(startWork(state, 'run-test-001'), `${index + 1}. startWork`);
    doneCounts[order[index]] += 1;
    finishWork(state, 'run-test-001', index + 1, { ...doneCounts }, 0);
  }
  const progress = records.filter((m) => m.type === 'PROCESSING_PROGRESS');
  const complete = records.filter((m) => m.type === 'PROCESSING_COMPLETE');
  assert.equal(progress.length, 10, 'her görselde 1 progress');
  assert.equal(complete.length, 1, 'tam olarak 1 completion');
  assert.equal(complete[0].counts.translated, 5);
  assert.equal(complete[0].counts.failedTechnical, 1);
  assert.equal(complete[0].cancelled, false);
  // toplam denklem
  assert.equal(complete[0].counts.translated + complete[0].counts.skippedNoText + complete[0].counts.filteredNoise + complete[0].counts.untranslated + complete[0].counts.failedTechnical, 10);
});

test('Senaryo 4 — kuyruk ortasında iptal: completion cancelled=true, ✓ yok', () => {
  const { state, records } = setup(10);
  // 5 paralel iş başlatılmış (her biri startWork + henüz finishWork yok)
  for (let index = 0; index < 5; index += 1) assert.ok(startWork(state, 'run-test-001'));
  cancel(state, 'run-test-001');
  // iptal sonrası 1 görsel yine de tamamlanır (içerde olan iş biter) → sadece progress atılır
  finishWork(state, 'run-test-001', 1, { translated: 1, skippedNoText: 0, filteredNoise: 0, untranslated: 0, failedTechnical: 0 }, 0);
  // run-level completion cancelled=true ile gelir
  finishCancelled(state, 'run-test-001', { translated: 1, skippedNoText: 0, filteredNoise: 0, untranslated: 0, failedTechnical: 0 }, 0);
  const complete = records.filter((m) => m.type === 'PROCESSING_COMPLETE');
  assert.equal(complete.length, 1);
  assert.equal(complete[0].cancelled, true, 'iptal edilen run cancelled=true ile biter');
});

test('Senaryo 5 — eski run mesajı yeni run’ı bozmaz (runId guard)', () => {
  const oldState = createRunState('run-old', 5);
  const oldRecords = [];
  subscribe(oldState, recordListener(oldRecords));
  // eski run kendi startWork'ünü aldı (içerideki görsel)
  startWork(oldState, 'run-old');
  // yeni run başladı → yeni state, eski state’teki çağrılar yutulur
  const newState = createRunState('run-new', 3);
  const newRecords = [];
  subscribe(newState, recordListener(newRecords));
  // eski run görseli gecikmiş tamamlama deniyor — runId eşleşir ama
  // yeni run state oluşturulduktan SONRA eski run'a finishWork çağrısı yine
  // eski state'in iç state'idir. Gerçek senaryoda: yeni run başlatılınca
  // content script'te runState referansı yenilenir; eski state'e yapılan
  // referans yoktur. Burada runId guard'ın yeni state üzerinde devreye
  // girmesini doğruluyoruz: yeni run'a yanlış runId ile finishWork gönderilirse
  // yutulur.
  const crossRun = finishWork(newState, 'run-old', 1, { translated: 1, skippedNoText: 0, filteredNoise: 0, untranslated: 0, failedTechnical: 0 }, 0);
  assert.equal(crossRun, null, 'yanlış runId ile tamamlama yeni run state’ine yazmaz');
  // yeni run kendi startWork'ü ile ilerler (toplam=1 görsel, senaryoyu sade tutalım)
  const tinyState = createRunState('run-new-tiny', 1);
  const tinyRecords = [];
  subscribe(tinyState, recordListener(tinyRecords));
  startWork(tinyState, 'run-new-tiny');
  const valid = finishWork(tinyState, 'run-new-tiny', 1, { translated: 1, skippedNoText: 0, filteredNoise: 0, untranslated: 0, failedTechnical: 0 }, 0);
  assert.ok(valid, 'yeni run kendi tamamlamasını yapar');
  assert.equal(tinyRecords.filter((m) => m.type === 'PROCESSING_COMPLETE').length, 1);
  assert.equal(tinyRecords.filter((m) => m.type === 'PROCESSING_PROGRESS').length, 1);
});

test('Senaryo 6 — son queued görsel bitmişken iki aktif işin devam etmesi: completion tetiklenmez', () => {
  const { state, records } = setup(5);
  // Gerçek content akışı: pumpQueue her seferinde 1 startWork + 1 finishWork tetikler.
  // Senaryoda 3 iş paralel aktifken 2'si tamamlanır, 1 hâlâ aktif → completion YOK.
  assert.ok(startWork(state, 'run-test-001'), 'görsel 1 aktif');
  assert.ok(startWork(state, 'run-test-001'), 'görsel 2 aktif');
  assert.ok(startWork(state, 'run-test-001'), 'görsel 3 aktif');
  // 3 paralel iş, 1 tamamlanır → active=2, done=1
  finishWork(state, 'run-test-001', 1, { translated: 1, skippedNoText: 0, filteredNoise: 0, untranslated: 0, failedTechnical: 0 }, 0);
  finishWork(state, 'run-test-001', 2, { translated: 2, skippedNoText: 0, filteredNoise: 0, untranslated: 0, failedTechnical: 0 }, 0);
  assert.equal(records.filter((m) => m.type === 'PROCESSING_COMPLETE').length, 0, 'aktif iş varken completion atılmaz');
  // 3. iş tamamlanır → active=0, done=3, total=5 → henüz yok
  finishWork(state, 'run-test-001', 3, { translated: 3, skippedNoText: 0, filteredNoise: 0, untranslated: 0, failedTechnical: 0 }, 0);
  assert.equal(records.filter((m) => m.type === 'PROCESSING_COMPLETE').length, 0, 'kuyrukta 2 kaldı, aktif=0 ama total<5; yine yok');
  // 4. ve 5. görsel pumpQueue ile startWork alır
  startWork(state, 'run-test-001');
  finishWork(state, 'run-test-001', 4, { translated: 4, skippedNoText: 0, filteredNoise: 0, untranslated: 0, failedTechnical: 0 }, 0);
  startWork(state, 'run-test-001');
  finishWork(state, 'run-test-001', 5, { translated: 5, skippedNoText: 0, filteredNoise: 0, untranslated: 0, failedTechnical: 0 }, 0);
  assert.equal(records.filter((m) => m.type === 'PROCESSING_COMPLETE').length, 1, '5/5 ve aktif=0 olunca tam 1 kez');
  assert.equal(records.filter((m) => m.type === 'PROCESSING_PROGRESS').length, 5);
});

test('toplam denklem: done = translated + skippedNoText + filteredNoise + untranslated + failedTechnical', () => {
  const { state } = setup(36);
  // run-stats.doneTotal ile aynı denklem modül tarafından korunuyor
  const counts = { translated: 20, skippedNoText: 6, filteredNoise: 4, untranslated: 2, failedTechnical: 4 };
  const done = Object.values(counts).reduce((sum, value) => sum + value, 0);
  assert.equal(done, 36);
  // Her görsel sırayla: 1 startWork + 1 finishWork (content script’teki gerçek akış).
  // Tüm 36 görsel için ardışık çağrı; her finishWork'te done sayısı güncellenir.
  for (let index = 0; index < 36; index += 1) {
    assert.ok(startWork(state, 'run-test-001'), `${index + 1}. görsel aktif işe alınmalı`);
    const runningCounts = { translated: 0, skippedNoText: 0, filteredNoise: 0, untranslated: 0, failedTechnical: 0 };
    const categories = ['translated', 'translated', 'translated', 'translated', 'translated', 'translated', 'translated', 'translated', 'translated', 'translated', 'translated', 'translated', 'translated', 'translated', 'translated', 'translated', 'translated', 'translated', 'translated', 'translated', 'skippedNoText', 'skippedNoText', 'skippedNoText', 'skippedNoText', 'skippedNoText', 'skippedNoText', 'filteredNoise', 'filteredNoise', 'filteredNoise', 'filteredNoise', 'untranslated', 'untranslated', 'failedTechnical', 'failedTechnical', 'failedTechnical', 'failedTechnical'];
    for (let j = 0; j <= index; j += 1) runningCounts[categories[j]] += 1;
    finishWork(state, 'run-test-001', index + 1, runningCounts, index < 5 ? 1 : 0);
  }
  const complete = state.completionEmitted;
  assert.ok(complete, '36/36 ve aktif=0 olunca completion tetiklenir');
});

test('dağıtılan content script run-lifecycle preludunu içerir ve popup ✓ sadece completion’da', async () => {
  const script = await readFile(new URL('../dist/chromium/content.js', import.meta.url), 'utf8');
  assert.match(script, /MANGA_TR_RUN_LIFECYCLE_START/);
  assert.match(script, /PROCESSING_PROGRESS/);
  assert.match(script, /PROCESSING_COMPLETE/);
  assert.match(script, /GET_RUN_LIFECYCLE/);
  assert.match(script, /runId/, 'runId akışı içeride');

  const match = script.match(/\/\* MANGA_TR_RUN_LIFECYCLE_START \*\/([\s\S]*?)\/\* MANGA_TR_RUN_LIFECYCLE_END \*\//);
  assert.ok(match);
  const sandbox = {}; sandbox.globalThis = sandbox;
  vm.runInNewContext(match[1], sandbox);
  const state = sandbox.MangaTrRunLifecycle.createRunState('r1', 2);
  const records = [];
  sandbox.MangaTrRunLifecycle.subscribe(state, (message) => records.push(message));
  sandbox.MangaTrRunLifecycle.startWork(state, 'r1');
  sandbox.MangaTrRunLifecycle.startWork(state, 'r1');
  sandbox.MangaTrRunLifecycle.finishWork(state, 'r1', 1, { translated: 1, skippedNoText: 0, filteredNoise: 0, untranslated: 0, failedTechnical: 0 }, 0);
  assert.equal(records.filter((m) => m.type === 'PROCESSING_COMPLETE').length, 0, '1/2 + aktif=1 → henüz completion yok');
  sandbox.MangaTrRunLifecycle.finishWork(state, 'r1', 2, { translated: 2, skippedNoText: 0, filteredNoise: 0, untranslated: 0, failedTechnical: 0 }, 0);
  const completes = records.filter((m) => m.type === 'PROCESSING_COMPLETE');
  assert.equal(completes.length, 1);
  assert.equal(completes[0].cancelled, false, '✓ göstermek için cancelled=false olmalı');

  const popupHtml = await readFile(new URL('../dist/chromium/popup.html', import.meta.url), 'utf8');
  assert.match(popupHtml, /id="complete"/);
  assert.match(popupHtml, /id="complete"\s+class="hide"/);
  const popupJs = await readFile(new URL('../dist/chromium/popup.js', import.meta.url), 'utf8');
  assert.match(popupJs, /GET_RUN_LIFECYCLE/);
  assert.match(popupJs, /Tamamlandı|iptal edildi/);
  assert.match(popupJs, /Sayfada manga görseli bulunamadı/);
});
