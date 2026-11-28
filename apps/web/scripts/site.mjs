import contract from '../../../packages/developer-client/openapi.json' with { type: 'json' };
import settings from '../site.config.mjs';
import { escapeHtml as e, publicArticles, repository, source } from './content.mjs';
import { home } from './home.mjs';

const products = [
  ['Mobile testing', '/#mobile-testing'], ['Agent evaluation', '/#agent-evaluation'],
  ['Human intelligence', '/#human-intelligence'], ['Verifiable execution', '/#verification'],
];
const developerLinks = [
  ['Documentation', '/docs'], ['Quickstart', '/docs/quickstart'],
  ['API reference', '/docs/api'], ['SDK and integrations', '/docs/integrations'],
];
const sections = [['Documentation', '/docs'], ['Contributors', '/contributors'], ['Pricing', '/pricing']];
const guides = [
  ['Documentation home', '/docs'], ['Quickstart', '/docs/quickstart'], ['Campaigns', '/docs/campaigns'],
  ['Integrations and SDK', '/docs/integrations'], ['Evidence verification', '/docs/evidence'], ['API reference', '/docs/api'],
];
const footerLinks = [
  ['Product', products],
  ['Developers', [['Quickstart', '/docs/quickstart'], ['API reference', '/docs/api'], ['SDK', '/docs/integrations'], ['Console', '/console.html']]],
  ['Contributors', [['How it works', '/contributors']]],
  ['Company', [['About', '/about'], ['Contact', '/contact'], ['Pricing', '/pricing'], ['Help', '/help'], ['GitHub', source]]],
  ['Legal', [['Privacy Policy', '/privacy'], ['Terms of Service', '/terms']]],
];

function optionalUrl(key, protocols) {
  const value = settings[key];
  if (!value) return '';
  const url = new URL(value);
  if (!protocols.includes(url.protocol) || url.username || url.password) throw new Error('Invalid public URL for ' + key);
  return url.href;
}

const config = {
  ...settings,
  contactUrl: optionalUrl('contactUrl', ['https:', 'mailto:']),
  privacyContactUrl: optionalUrl('privacyContactUrl', ['https:', 'mailto:']),
  contributorDownloadUrl: optionalUrl('contributorDownloadUrl', ['https:']),
  waitlistUrl: optionalUrl('waitlistUrl', ['https:']),
};
if (!['demo', 'waitlist', 'general'].includes(config.launchMode)) throw new Error('Invalid public launch mode');
const action = config.launchMode === 'waitlist'
  ? config.waitlistUrl ? ['Join the waitlist', config.waitlistUrl] : ['View launch updates', '/availability']
  : ['Start building', '/console.html'];
const cta = `<a class="site-button primary" href="${e(action[1])}">${action[0]} <span class="action-arrow" aria-hidden="true"></span></a>`;

const darkLockup = '<img class="brand-dark" src="/assets/brand-lockup-dark.svg" width="145" height="34" alt="AGUS AI">';
const lightLockup = '<img class="brand-light" src="/assets/brand-lockup-light.svg" width="145" height="34" alt="AGUS AI">';
const brand = `<a class="site-brand" href="/" aria-label="AGUS AI home">${darkLockup}${lightLockup}</a>`;
const themeControl = '<label class="workspace-theme"><span>Theme</span><select aria-label="Color theme" data-theme-control><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label>';

function links(items, path) {
  return items.map(([label, href]) => `<a href="${e(href)}"${href === path ? ' aria-current="page"' : ''}>${e(label)}</a>`).join('');
}

function header(path, workspace) {
  const menu = (name, linksList) => `<details class="nav-menu"><summary>${name}</summary><div>${links(linksList, path)}</div></details>`;
  const navItems = `${menu('Product', products)}${menu('Developers', developerLinks)}${links(sections, path)}`;
  const actions = `<a href="/console.html">Sign in</a>${workspace ? themeControl : cta}`;
  return `<header class="site-header"><div class="shell site-nav">${brand}
    <nav class="desktop-nav" aria-label="Primary">${navItems}</nav>
    <div class="nav-actions">${actions}</div>
    <details class="mobile-menu"><summary aria-label="Open navigation"><span></span><span></span></summary>
      <nav aria-label="Mobile navigation">${navItems}${actions}</nav>
    </details>
  </div></header>`;
}

const footer = `<footer class="site-footer"><div class="shell">
  <div class="footer-content"><div>${brand}<p>Mobile intelligence infrastructure.</p></div>
    ${footerLinks.map(([label, items]) => `<div class="footer-links"><h2>${label}</h2>${links(items)}</div>`).join('')}
  </div>
  <div class="footer-mark" aria-hidden="true"><img src="/assets/brand-wordmark-dark.svg" width="460" height="85" alt=""></div>
  <div class="footer-end"><span>© AGUS AI</span><div>${links([['Privacy Policy', '/privacy'], ['Terms of Service', '/terms']])}</div></div>
</div></footer>`;

function page({ path, title, description, content, className = '' }) {
  const workspace = path === '/docs' || path.startsWith('/docs/');
  const canonical = config.origin + (path === '/' ? '/' : path);
  return `<!doctype html>
<html lang="en"${workspace ? ' data-workspace' : ''}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#080809">
<title>${e(title)}</title>
<meta name="description" content="${e(description)}">
${path === '/404' ? '<meta name="robots" content="noindex, follow">' : `<link rel="canonical" href="${e(canonical)}">`}
<meta property="og:type" content="website">
<meta property="og:site_name" content="AGUS AI">
<meta property="og:title" content="${e(title)}">
<meta property="og:description" content="${e(description)}">
<meta property="og:url" content="${e(canonical)}">
<meta property="og:image" content="${e(config.origin)}/assets/social.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="AGUS AI. Android testing infrastructure for release teams.">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/assets/agus-orbital-mark.png" type="image/png">
<link rel="preload" href="/assets/geist.woff2" as="font" type="font/woff2" crossorigin>
${workspace ? '<script src="/theme.js"></script><link rel="stylesheet" href="/theme.css">' : ''}
<link rel="stylesheet" href="/site.css">
<script type="module" src="/site.mjs"></script>
</head>
<body class="${className}">
<a class="skip" href="#main">Skip to content</a>
${header(path, workspace)}
<main id="main" tabindex="-1">${content}</main>
${footer}
</body>
</html>`;
}

const apiGroups = [
  ['Identity and projects', '/auth/me', '/auth/refresh', '/auth/logout', '/projects', '/builds', '/devices'],
  ['Runs and receipts', '/runs', '/runs/{runId}', '/runs/{runId}/events', '/runs/{runId}/cancel', '/runs/{runId}/verify', '/runs/{runId}/actions', '/runs/{runId}/evidence/{sha256}'],
  ['Campaigns and assignment review', '/campaigns', '/campaigns/{campaignId}', '/campaigns/{campaignId}/report', '/assignments/{assignmentId}/reviews', '/assignments/{assignmentId}/receipt'],
];
const methodNames = new Set(['get', 'post', 'patch', 'put', 'delete']);

function apiOverview() {
  return `<section><h2>Authentication</h2><p>Send an eligible person bearer in the <code>Authorization</code> header. Use the ${links([['integration guide', '/docs/integrations']])} to obtain a session. Ownership and deployment policy determine which resources and operations are available.</p>
    <p><a href="${repository.replace('/tree/', '/blob/')}/packages/developer-client/openapi.json">View the complete versioned OpenAPI schema</a></p></section>
    ${apiGroups.map(([title, ...paths]) => `<section><h2>${title}</h2><div class="api-operations">${paths.map(path => {
    const route = '/api/v1' + path;
    const operations = contract.paths[route];
    if (!operations) throw new Error('Missing OpenAPI route ' + route);
    return Object.entries(operations).filter(([method]) => methodNames.has(method)).map(([method, operation]) => {
      const body = operation.requestBody?.content?.['application/json']?.schema;
      const schema = body?.$ref ? body.$ref.split('/').at(-1) : body && Object.keys(body.properties ?? {}).join(', ');
      const responses = Object.keys(operation.responses).join(', ');
      return `<details><summary><b class="method">${method.toUpperCase()}</b><code>${e(route)}</code></summary>
        <p>${e(operation.summary)}.</p>${schema ? `<p>Request body <code>${e(schema)}</code></p>` : ''}<p>Responses <code>${e(responses)}</code></p></details>`;
    }).join('');
  }).join('')}</div></section>`).join('')}`;
}

const articles = {
  ...publicArticles(config),
  '/docs/api': ['API reference', 'Control-plane API', 'Core developer endpoints from the versioned AGUS AI OpenAPI contract.', apiOverview()],
  ...(config.launchMode === 'waitlist' && {
    '/availability': ['Availability', 'AGUS AI is coming soon.', 'The developer platform is preparing for wider availability.',
      config.waitlistUrl ? `<div class="page-actions">${cta}</div>` : '<section><h2>Private preview</h2><p>Existing preview accounts can still sign in. Find product updates and questions through the <a href="/contact">contact page</a>.</p></section>'],
  }),
};

function article(path, [title, heading, description, body]) {
  const docs = path === '/docs' || path.startsWith('/docs/');
  const landingActions = ['/product', '/developers'].includes(path) ? `<div class="page-actions">${cta}</div>` : '';
  return page({ path, title: title + ' · AGUS AI', description, className: 'article-page',
    content: `<div class="page-mast"><div class="shell"><p><a href="/">AGUS AI</a> <span aria-hidden="true">/</span> ${e(title)}</p>
      <h1>${e(heading)}</h1><p>${e(description)}</p>${landingActions}</div></div>
      <div class="shell page-layout${docs ? ' docs-layout' : ''}">
        ${docs ? `<aside class="docs-sidebar"><nav aria-label="Documentation">${links(guides, path)}</nav></aside>` : ''}
        <article class="prose">${body}</article>
      </div>`,
  });
}

export function generatedAssets() {
  const files = new Map();
  files.set('/index.html', page({
    path: '/', title: 'AGUS AI · Android testing and execution evidence',
    description: 'Test Android apps, evaluate agents, and bring human feedback into the same workflow. Inspect signed execution evidence and supported Solana outcomes.',
    content: home(cta), className: 'home-page',
  }));
  for (const [path, body] of Object.entries(articles)) files.set(path + '.html', article(path, body));
  files.set('/robots.txt', `User-agent: *\nDisallow: /console.html\nDisallow: /api/\nDisallow: /invite\nSitemap: ${config.origin}/sitemap.xml\n`);
  const urls = ['/', ...Object.keys(articles).filter(path => path !== '/404')].map(path => `<url><loc>${e(config.origin + path)}</loc></url>`);
  files.set('/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join('')}</urlset>\n`);
  return files;
}
