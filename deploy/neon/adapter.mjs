import { once } from 'node:events';
import { request as send } from 'node:http';
import { Readable } from 'node:stream';

const hopByHop = ['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
  'te', 'trailer', 'transfer-encoding', 'upgrade'];
const proxyHeaders = ['host', 'forwarded', 'x-forwarded-for', 'x-forwarded-host', 'x-forwarded-proto'];
const emptyStatuses = [204, 205, 304];
const policies = {
  'Cache-Control': 'no-cache',
  'Content-Security-Policy': "default-src 'self'; frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'",
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
};

function stripTransport(headers, extra = []) {
  const named = headers.get('connection')?.split(',').map(value => value.trim()) ?? [];
  for (const header of [...hopByHop, ...extra, ...named]) {
    if (header) headers.delete(header);
  }
  return headers;
}

async function listen(server) {
  const ready = once(server, 'listening');
  server.listen(0, '127.0.0.1');
  await ready;
  return server.address().port;
}

function proxyToControlPlane(port, request, url) {
  const headers = stripTransport(new Headers(request.headers), proxyHeaders);
  return new Promise((resolve, reject) => {
    const outgoing = send({
      host: '127.0.0.1', port, method: request.method, path: url.pathname + url.search,
      signal: request.signal, headers: Object.fromEntries(headers),
    }, incoming => {
      const responseHeaders = new Headers();
      for (let index = 0; index < incoming.rawHeaders.length; index += 2) {
        responseHeaders.append(incoming.rawHeaders[index], incoming.rawHeaders[index + 1]);
      }
      const status = incoming.statusCode;
      const empty = request.method === 'HEAD' || emptyStatuses.includes(status);
      if (empty) incoming.resume();
      resolve(new Response(empty ? null : Readable.toWeb(incoming), {
        status, headers: stripTransport(responseHeaders),
      }));
    });
    outgoing.once('error', reject);
    if (request.body) {
      const input = Readable.fromWeb(request.body);
      input.once('error', error => outgoing.destroy(error));
      outgoing.once('close', () => input.destroy());
      input.pipe(outgoing);
    } else {
      outgoing.end();
    }
  });
}

export function createNeonHandler({ assets, createService, reportError = () => {} }) {
  let startup;

  function getPort() {
    startup ??= (async () => {
      const { server, store } = await createService();
      try {
        return await listen(server);
      } catch (error) {
        await store.close();
        throw error;
      }
    })().catch(error => {
      startup = undefined;
      throw error;
    });
    return startup;
  }

  return {
    async fetch(request) {
      const url = new URL(request.url);
      if (['/health', '/api/v1', '/.well-known/assetlinks.json', '/auth/android'].includes(url.pathname) || url.pathname.startsWith('/api/v1/')) {
        try {
          return await proxyToControlPlane(await getPort(), request, url);
        } catch (error) {
          reportError(error);
          return Response.json({ error: { code: 'not_ready', message: 'The control plane is unavailable.' } }, {
            status: 503, headers: { 'Cache-Control': 'no-store' },
          });
        }
      }
      if (!['GET', 'HEAD'].includes(request.method)) {
        return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
      }
      const invitation = /^\/invite(?:\/([A-Za-z0-9_-]{24,100}))?\/?$/.exec(url.pathname);
      if (invitation) {
        const location = '/console.html' + (invitation[1] ? '#invite/' + invitation[1] : '');
        return new Response(null, {
          status: 302,
          headers: { Location: location, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' },
        });
      }
      if (url.pathname === '/invite') {
        return new Response(null, { status: 302, headers: {
          Location: '/console.html', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer',
        } });
      }
      const asset = assets.get(url.pathname === '/' ? '/index.html' : url.pathname);
      if (!asset) return new Response('Page not found.', { status: 404 });
      return new Response(request.method === 'HEAD' ? null : asset.bytes, {
        headers: { ...policies, 'Content-Type': asset.type, 'Content-Length': String(asset.bytes.length) },
      });
    },
  };
}
