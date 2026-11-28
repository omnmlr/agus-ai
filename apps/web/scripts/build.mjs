import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { generatedAssets } from './site.mjs';

const source = new URL('../public/', import.meta.url);
const distribution = new URL('../dist/', import.meta.url);
await rm(distribution, { recursive: true, force: true });
await cp(source, distribution, { recursive: true });
for (const [path, content] of generatedAssets()) {
  const file = new URL(path.slice(1), distribution);
  await mkdir(new URL('.', file), { recursive: true });
  await writeFile(file, content);
}
console.log('Web assets built in apps/web/dist/');
