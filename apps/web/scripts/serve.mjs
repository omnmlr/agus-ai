import { pathToFileURL } from 'node:url';
import { createWebServer } from './web-server.mjs';

export { createWebServer };

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const directory = new URL(process.argv.includes('--dist') ? '../dist/' : '../public/', import.meta.url);
  const host = process.env.WEB_HOST || '127.0.0.1';
  const port = Number(process.env.WEB_PORT || 4173);
  const upstream = process.env.CONTROL_PLANE_ORIGIN || 'http://127.0.0.1:8080';
  const server = createWebServer({ upstream, directory, ...(process.argv.includes('--dist') && { pages: null }) });
  server.listen(port, host, () => console.log(`AGUS web listening on http://${host}:${server.address().port}`));
}
