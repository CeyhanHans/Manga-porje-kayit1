import { readdir, readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const expected = ['README.txt', 'background.js', 'content.js', 'manifest.json', 'ocr-core', 'ocr-frame.html', 'ocr-frame.js', 'ocr-lang', 'ocr-worker.min.js', 'ocr.js', 'popup.html', 'popup.js'];
const digest = (content) => createHash('sha256').update(content).digest('hex');

for (const target of ['chromium', 'firefox']) {
  const distDir = new URL(`../dist/${target}/`, import.meta.url);
  const packageDir = new URL(`../outputs/packages/${target}/`, import.meta.url);
  const entries = (await readdir(packageDir)).sort();
  if (JSON.stringify(entries) !== JSON.stringify([...expected].sort())) throw new Error(`${target}: staged package has unexpected files: ${entries.join(', ')}`);
  for (const file of expected.filter((entry) => !entry.endsWith('-core') && !entry.endsWith('-lang'))) {
    const [distFile, packageFile] = await Promise.all([readFile(new URL(file, distDir)), readFile(new URL(file, packageDir))]);
    if (digest(distFile) !== digest(packageFile)) throw new Error(`${target}: ${file} differs from dist`);
  }
  for (const directory of ['ocr-core', 'ocr-lang']) {
    const distEntries = (await readdir(new URL(`${directory}/`, distDir))).sort();
    const packageEntries = (await readdir(new URL(`${directory}/`, packageDir))).sort();
    if (JSON.stringify(distEntries) !== JSON.stringify(packageEntries)) throw new Error(`${target}: staged ${directory} differs from dist`);
  }
  const manifest = JSON.parse(await readFile(new URL('manifest.json', packageDir), 'utf8'));
  if (!(manifest.permissions ?? []).includes('storage')) throw new Error(`${target}: missing storage permission for local DeepL configuration`);
  if (target === 'chromium' && (!(manifest.permissions ?? []).includes('declarativeNetRequest') || !(manifest.permissions ?? []).includes('declarativeNetRequestWithHostAccess'))) throw new Error('chromium: missing protected-image referrer permissions');
  if (target === 'firefox') {
    if (!(manifest.permissions ?? []).includes('webRequestBlocking') || !(manifest.permissions ?? []).includes('<all_urls>')) throw new Error('firefox: missing protected-image request permissions');
    const declaredData = manifest.browser_specific_settings?.gecko?.data_collection_permissions?.required ?? [];
    if (!declaredData.includes('authenticationInfo') || !declaredData.includes('websiteContent')) throw new Error('firefox: missing required remote data collection declarations');
    const ocrScripts = await Promise.all(['ocr.js', 'ocr-frame.js', 'ocr-worker.min.js'].map((file) => readFile(new URL(file, packageDir), 'utf8')));
    if (/new Function\(|Function\(["']r["']/.test(ocrScripts.join('\n'))) throw new Error('firefox: unsafe eval fallback remains in the delivered OCR scripts');
  }
  const content = await readFile(new URL('content.js', packageDir), 'utf8');
  if (!content.includes('MANGA_TR_GEOMETRY_START') || !content.includes('AbortController')) throw new Error(`${target}: missing delivered geometry or cleanup fix`);
  const deliveredText = await Promise.all(['background.js', 'content.js', 'manifest.json', 'popup.html', 'popup.js'].map((file) => readFile(new URL(file, packageDir), 'utf8')));
  if (/DeepL-Auth-Key\s+[A-Za-z0-9-]{20,}:fx/.test(deliveredText.join('\n'))) throw new Error(`${target}: a DeepL API key was embedded in the delivery package`);
  await stat(packageDir);
}
console.log(`Delivery packages verified from ${fileURLToPath(root)}`);

