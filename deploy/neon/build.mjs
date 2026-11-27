import { mkdir, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const destination = path.resolve(process.argv[2] ?? path.join(root, 'deploy/neon/dist'));
const site = path.join(root, 'apps/web/public');
const mediaTypes = new Map([
  ['.html', 'text/html; charset=utf-8'], ['.css', 'text/css; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'], ['.js', 'text/javascript; charset=utf-8'],
  ['.svg', 'image/svg+xml'], ['.png', 'image/png'], ['.webp', 'image/webp'],
  ['.jpg', 'image/jpeg'], ['.jpeg', 'image/jpeg'], ['.ico', 'image/x-icon'],
  ['.woff2', 'font/woff2'], ['.json', 'application/json'], ['.txt', 'text/plain; charset=utf-8'],
]);

const paths = (await readdir(site, { recursive: true, withFileTypes: true }))
  .filter(entry => entry.isFile())
  .map(entry => path.join(entry.parentPath, entry.name))
  .sort();
const entries = [];
for (const file of paths) {
  const url = `/${path.relative(site, file).split(path.sep).join('/')}`;
  if (url !== '/.well-known/assetlinks.json' && url.split('/').some(segment => segment.startsWith('.'))) continue;
  const type = mediaTypes.get(path.extname(file));
  if (!type) throw new Error(`Unsupported public asset type: ${url}`);
  entries.push([url, type, (await readFile(file)).toString('base64')]);
}
if (!entries.some(([url]) => url === '/index.html')) throw new Error('Public entry page is missing.');

await mkdir(destination, { recursive: true });
await build({
  entryPoints: [path.join(here, 'index.mjs')], outfile: path.join(destination, 'index.mjs'),
  bundle: true, minify: true, platform: 'node', target: 'node24', format: 'esm',
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
  plugins: [{
    name: 'embed-public-assets',
    setup(builder) {
      builder.onResolve({ filter: /^agus-web-assets$/ }, () => ({ path: 'site', namespace: 'agus-assets' }));
      builder.onLoad({ filter: /.*/, namespace: 'agus-assets' }, () => ({
        contents: `export default new Map(${JSON.stringify(entries)}.map(([url,type,b64]) => [url, {type,bytes:Buffer.from(b64,'base64')}]));`,
      }));
    },
  }],
});
console.log(`Bundled ${entries.length} public assets and the control plane into ${destination}`);
