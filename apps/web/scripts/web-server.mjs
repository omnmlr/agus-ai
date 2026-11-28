import { readFile } from 'node:fs/promises';
import { createServer, request as requestHttp } from 'node:http';
import { request as requestHttps } from 'node:https';

import { assetPath, contentType, webPolicies } from './asset-paths.mjs';
import { generatedAssets } from './site.mjs';

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

export function createWebServer({ upstream, directory, pages = generatedAssets() }) {
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
    if (['/health', '/api/v1', '/.well-known/assetlinks.json', '/auth/android'].includes(pathname) || pathname.startsWith('/api/v1/')) {
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
    const file = assetPath(pathname);
    const read = async path => {
      if (pages?.has(path)) return Buffer.from(pages.get(path));
      if (!path || !contentType(path)) return null;
      try {
        return await readFile(new URL(path.slice(1), directory));
      } catch (error) {
        if (error.code === 'ENOENT' || error.code === 'EISDIR') return null;
        throw error;
      }
    };
    try {
      const asset = await read(file);
      const contents = asset ?? await read('/404.html');
      const status = asset ? 200 : 404;
      if (!contents) {
        response.writeHead(status).end('Page not found.');
        return;
      }
      response.writeHead(status, {
        ...webPolicies,
        'Content-Type': contentType(asset ? file : '/404.html'),
        'Content-Length': contents.byteLength,
      });
      response.end(request.method === 'HEAD' ? undefined : contents);
    } catch {
      response.writeHead(503).end('Web assets unavailable. Build the web app before serving dist.');
    }
  });
}
