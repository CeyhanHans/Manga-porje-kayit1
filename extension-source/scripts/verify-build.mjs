/* DUZELTME_GOREV3_BAŞLANGIÇ: dist doğrulama adımı (`npm run dev` zincirinin son adımı).
   - dist/chromium ve dist/firefox envanteri,
   - build kimliği biçimi ve hedefler arası tutarlılık,
   - manifest version_name ↔ build-info.json eşleşmesi,
   - build sırasında yazılan outputs/build-hashes.txt tablosunun diskteki dosyalarla
     yeniden hesaplanarak eşleşmesi
   doğrulanır. Desktop\chromium'a kopyalama YAPMAZ (görev kuralı). */
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const digest = (content) => createHash('sha256').update(content).digest('hex');
const expectedFiles = ['README.txt', 'background.js', 'build-info.json', 'content.js', 'manifest.json', 'ocr-core', 'ocr-frame.html', 'ocr-frame.js', 'ocr-lang', 'ocr-worker.min.js', 'ocr.js', 'popup.html', 'popup.js'];
const buildIdPattern = /^[0-9a-f]{7,40}\.\d{8}T\d{6}-\d{3}Z$|^nogit\.\d{8}T\d{6}-\d{3}Z$/;

const hashTableText = await readFile(new URL('../outputs/build-hashes.txt', import.meta.url), 'utf8');
const recorded = new Map(hashTableText.split('\n').filter((line) => line.includes('  ')).map((line) => [line.slice(0, line.indexOf('  ')), line.slice(line.indexOf('  ') + 2).trim()]));
const buildIds = [];

for (const target of ['chromium', 'firefox']) {
  const distDir = new URL(`../dist/${target}/`, import.meta.url);
  const entries = (await readdir(distDir)).sort();
  if (JSON.stringify(entries) !== JSON.stringify([...expectedFiles].sort())) throw new Error(`${target}: dist envanteri beklenmedik: ${entries.join(', ')}`);

  const info = JSON.parse(await readFile(new URL('build-info.json', distDir), 'utf8'));
  if (info.schema !== 'manga-tr-build-info/1') throw new Error(`${target}: build-info.json şeması geçersiz`);
  if (!buildIdPattern.test(info.buildId)) throw new Error(`${target}: buildId biçimi geçersiz: ${info.buildId}`);
  if (!info.buildId.startsWith(`${info.commit}.`)) throw new Error(`${target}: buildId commit ile tutarsız`);
  buildIds.push(info.buildId);

  const manifest = JSON.parse(await readFile(new URL('manifest.json', distDir), 'utf8'));
  if (target === 'chromium' && manifest.version_name !== `${manifest.version}+${info.buildId}`) throw new Error(`chromium: manifest version_name (${manifest.version_name ?? 'yok'}) build-info ile eşleşmiyor (${info.buildId})`);
  if (target === 'firefox' && manifest.version_name !== undefined) throw new Error('firefox: manifest version_name içermemeli');

  for (const file of expectedFiles) {
    if (file === 'ocr-core' || file === 'ocr-lang') {
      const dirEntries = (await readdir(new URL(`${file}/`, distDir))).sort();
      const actual = `(${dirEntries.length} dosya) ${digest(Buffer.from(dirEntries.join('\n')))}`;
      const expected = recorded.get(`${target}/${file}/`);
      if (expected !== actual) throw new Error(`${target}/${file}: envanter hash'i build kaydıyla eşleşmiyor (kayıt: ${expected}, disk: ${actual})`);
      continue;
    }
    const actual = digest(await readFile(new URL(file, distDir)));
    const expected = recorded.get(`${target}/${file}`);
    if (expected !== actual) throw new Error(`${target}/${file}: sha256 build kaydıyla eşleşmiyor (kayıt: ${expected}, disk: ${actual})`);
  }
  if (target === 'chromium') console.log(`Doğrulandı: dist/${target} — Build ID: ${info.buildId} — ${expectedFiles.length} envanter girdisi, hash'ler eşleşti`);
}

if (buildIds[0] !== buildIds[1]) throw new Error(`hedefler farklı buildId taşıyor: ${buildIds.join(' ≠ ')}`);
console.log('Desktop\\chromium kopyalanmadı (görev kuralı: otomatik kopyalama yok).');
/* DUZELTME_GOREV3_BİTİŞ */
