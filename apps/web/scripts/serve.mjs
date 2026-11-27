import { readFile } from 'node:fs/promises';
import { createServer, request as requestHttp } from 'node:http';
import { request as requestHttps } from 'node:https';
import { pathToFileURL } from 'node:url';

const extensionTypes = new Map([
  ['html', 'text/html; charset=utf-8'], ['css', 'text/css; charset=utf-8'], ['mjs', 'text/javascript; charset=utf-8'],
]);
const staticPaths = new Set(['index.html', 'console.html', 'styles.css', 'api.mjs', 'views.mjs', 'console.mjs']);
const hopByHop = ['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailer', 'transfer-encoding', 'upgrade'];

function forwardHeaders(headers) {
  const forwarded = { ...headers };
  const named = headers.connection?.split(',').map((header) => header.trim().toLowerCase()) || [];
  for (const header of [...hopByHop, ...named]) delete forwarded[header];
  return forwarded;
}

function apiError(response) {
  if (response.headersSent) {
    response.destroy();
    return;
  }
  response.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify({ error: { code: 'control_plane_unavailable', message: 'The control plane is unavailable. Try again after it starts.' } }));
}

function proxy(incoming, outgoing, upstream, path) {
  const send = upstream.protocol === 'https:' ? requestHttps : requestHttp;
  const headers = forwardHeaders(incoming.headers);
  headers.host = upstream.host;
  const request = send(upstream, { path, method: incoming.method, headers }, (response) => {
    outgoing.writeHead(response.statusCode, forwardHeaders(response.headers));
    response.on('error', () => apiError(outgoing));
    response.pipe(outgoing);
  });
  request.on('error', () => apiError(outgoing));
  incoming.on('error', () => request.destroy());
  outgoing.on('close', () => request.destroy());
  incoming.pipe(request);
}

export function createWebServer({ upstream, directory }) {
  const controlPlane = new URL(upstream);
  if (!['http:', 'https:'].includes(controlPlane.protocol) || controlPlane.pathname !== '/' || controlPlane.username || controlPlane.password || controlPlane.search || controlPlane.hash) {
    throw new Error('CONTROL_PLANE_ORIGIN must be an HTTP or HTTPS origin.');
  }
  return createServer(async (request, response) => {
    if (!request.url?.startsWith('/') || request.url.startsWith('//')) {
      response.writeHead(400).end('Invalid request path.');
      return;
    }
    const { pathname, search } = new URL(request.url, 'http://localhost');
    if (pathname === '/api/v1' || pathname.startsWith('/api/v1/')) {
      proxy(request, response, controlPlane, pathname + search);
      return;
    }
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(405, { Allow: 'GET, HEAD' }).end('Method not allowed.');
      return;
    }
    const invitePath = /^\/invite(?:\/([A-Za-z0-9_-]{20,160}))?\/?$/.exec(pathname);
    if (invitePath) {
      response.writeHead(302, {
        Location: `/console.html${invitePath[1] ? `#invite/${invitePath[1]}` : ''}`,
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'no-referrer',
      }).end();
      return;
    }
    const file = pathname === '/' ? 'index.html' : pathname.slice(1);
    if (!staticPaths.has(file)) {
      response.writeHead(404).end('Page not found.');
      return;
    }
    try {
      const contents = await readFile(new URL(file, directory));
      response.writeHead(200, {
        'Content-Type': extensionTypes.get(file.split('.').at(-1)),
        'Content-Length': contents.byteLength,
        'Content-Security-Policy': "default-src 'self'; img-src 'self' blob:; frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'",
        'Referrer-Policy': 'no-referrer',
        'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff',
      });
      response.end(request.method === 'HEAD' ? undefined : contents);
    } catch {
      response.writeHead(503).end('Web assets unavailable. Build the web app before serving dist.');
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const directory = new URL(process.argv.includes('--dist') ? '../dist/' : '../public/', import.meta.url);
  const host = process.env.WEB_HOST || '127.0.0.1';
  const port = Number(process.env.WEB_PORT || 4173);
  const upstream = process.env.CONTROL_PLANE_ORIGIN || 'http://127.0.0.1:8080';
  const server = createWebServer({ upstream, directory });
  server.listen(port, host, () => console.log(`AGUS web listening on http://${host}:${server.address().port}`));
}
