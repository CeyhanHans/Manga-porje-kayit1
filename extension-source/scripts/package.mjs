import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const dist = new URL('../dist/', import.meta.url);
const packages = new URL('../outputs/packages/', import.meta.url);

await rm(packages, { recursive: true, force: true });
await mkdir(packages, { recursive: true });
for (const target of ['chromium', 'firefox']) {
  await cp(new URL(`${target}/`, dist), new URL(`${target}/`, packages), { recursive: true, force: true });
}
console.log(`Staged delivery packages at ${fileURLToPath(packages)}`);

