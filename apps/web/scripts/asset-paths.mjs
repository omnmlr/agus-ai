const types = {
  html: 'text/html; charset=utf-8', css: 'text/css; charset=utf-8',
  mjs: 'text/javascript; charset=utf-8', js: 'text/javascript; charset=utf-8',
  svg: 'image/svg+xml', png: 'image/png', webp: 'image/webp',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', ico: 'image/x-icon', woff2: 'font/woff2',
  json: 'application/json', txt: 'text/plain; charset=utf-8', xml: 'application/xml; charset=utf-8',
};

export function contentType(file) {
  const extension = file.split('.').at(-1);
  return Object.hasOwn(types, extension) ? types[extension] : undefined;
}

export function assetPath(pathname) {
  if (pathname === '/') return '/index.html';
  if (/^\/(?:[a-z0-9-]+\/)*[a-z0-9-]+\/?$/.test(pathname)) {
    return pathname.replace(/\/$/, '') + '.html';
  }
  return /^\/(?:[\w-]+\/)*[\w.-]+\.[a-z0-9]+$/i.test(pathname) ? pathname : null;
}

export const webPolicies = {
  'Cache-Control': 'no-cache',
  'Content-Security-Policy': "default-src 'self'; img-src 'self' blob:; frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'",
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
};
