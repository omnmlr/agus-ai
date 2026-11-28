import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const { chromium } = await import(process.env.PLAYWRIGHT_CORE_MODULE || 'playwright-core');
const origin = process.env.AGUS_WEB_ORIGIN || 'http://127.0.0.1:4173';
const captures = process.env.AGUS_BROWSER_SCREENSHOTS;
if (!captures) throw new Error('Set AGUS_BROWSER_SCREENSHOTS to a review output directory.');
await mkdir(captures, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM || '/usr/bin/chromium',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const paths = [
  '/', '/product', '/developers', '/docs', '/docs/quickstart', '/docs/api', '/docs/campaigns',
  '/docs/integrations', '/docs/evidence', '/contributors', '/about', '/contact', '/pricing', '/help', '/privacy', '/terms',
];
const dimensions = [[1440,900], [1280,800], [1024,768], [768,1024], [390,844], [375,812]];
const destinations = new Set();
const faults = [];
const shot = (target, name, options = {}) => target.screenshot({
  path: join(captures, name + '.jpg'), type: 'jpeg', quality: 82, ...options,
});
function monitor(page) {
  page.on('pageerror', error => faults.push(error.message));
  page.on('console', message => { if (message.type() === 'error') faults.push(message.text()); });
  page.on('requestfailed', request => faults.push(request.url() + ' ' + request.failure()?.errorText));
}
async function checkViewport(page, label) {
  const view = await page.evaluate(() => ({
    width: document.documentElement.clientWidth, body: document.documentElement.scrollWidth,
    type: document.fonts.check('600 80px Geist') && getComputedStyle(document.querySelector('h1')).fontFamily.includes('Geist'),
  }));
  assert.equal(view.width, view.body, 'Horizontal overflow ' + label);
  assert.ok(view.type, 'Geist fallback ' + label);
}
try {
  for (const [width, height] of dimensions) {
    const context = await browser.newContext({
      viewport: { width, height }, deviceScaleFactor: 1, isMobile: width <= 390,
      hasTouch: width <= 390, reducedMotion: 'reduce', permissions: ['clipboard-read', 'clipboard-write'],
    });
    const page = await context.newPage();
    monitor(page);
    await page.goto(origin, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await checkViewport(page, String(width));
    assert.equal(await page.getByRole('heading', { level: 1 }).count(), 1);
    assert.ok((await page.locator('.orbital-scene img').boundingBox()).y < height);
    await shot(page, 'home-' + width);

    const stages = page.locator('[data-replay] [data-step]');
    await stages.nth(0).click();
    assert.equal(await stages.nth(0).getAttribute('aria-pressed'), 'true');
    if (width === 1440) await shot(page.locator('[data-replay]'), 'stage-register');
    await stages.nth(0).press('ArrowRight');
    await page.getByText('Runner allocated', { exact: true }).first().waitFor();
    await stages.nth(2).click();
    await page.getByText('Wallet callback received', { exact: true }).first().waitFor();
    if (width === 1440) await shot(page.locator('[data-replay]'), 'stage-execute');
    await stages.nth(4).click();
    assert.equal(await stages.nth(4).getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('[data-replay-state]').innerText(), 'Receipt verified');
    assert.equal(await page.locator('[data-replay-value]').innerText(), '527,148,291');
    if (width === 1440 || width === 390) await shot(page.locator('[data-replay]'), 'stage-verify-' + width);

    if (width === 390 || width === 1440) {
      await page.evaluate(() => window.scrollTo(0, 0));
      if (width === 390) {
        await page.getByLabel('Open navigation').click();
        await page.locator('.mobile-menu .nav-menu summary').first().click();
        await shot(page, 'navigation-open');
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('.mobile-menu').getAttribute('open'), null);
      } else {
        await page.locator('.desktop-nav .nav-menu summary').first().click();
        await shot(page, 'navigation-desktop');
        await page.keyboard.press('Escape');
      }
      await stages.nth(0).click();
      for (const selector of ['.console-preview img', '.contributor-layout img']) {
        const image = page.locator(selector);
        await image.scrollIntoViewIfNeeded();
        await image.evaluate(element => element.decode());
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      await shot(page, 'home-full-' + width, { fullPage: true });
      await shot(page.locator('footer'), 'footer-' + width);
    }

    if (width === 1440) {
      for (const path of paths) {
        const response = await page.goto(origin + path, { waitUntil: 'networkidle' });
        assert.equal(response.status(), 200, path);
        for (const href of await page.locator('a[href]').evaluateAll(nodes => nodes.map(node => node.getAttribute('href')))) {
          if ((href.startsWith('/') && !href.startsWith('//')) || href.startsWith('#')) {
            destinations.add(new URL(href, origin + path).href);
          }
        }
        if (['/product', '/privacy', '/terms', '/docs/quickstart', '/docs/api'].includes(path)) {
          await shot(page, path.slice(1).replace('/', '-') + '-desktop');
        }
      }
      await page.goto(origin + '/docs/quickstart', { waitUntil: 'networkidle' });
      await page.getByRole('button', { name: 'Copy' }).click();
      assert.match(await page.evaluate(() => navigator.clipboard.readText()), /cli\.mjs projects/);
      await page.getByLabel('Color theme').filter({ visible: true }).selectOption('dark');
      await shot(page, 'docs-dark');
      await page.reload({ waitUntil: 'domcontentloaded' });
      assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
      await page.goto(origin + '/console.html', { waitUntil: 'domcontentloaded' });
      assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
      await page.evaluate(() => document.fonts.ready);
      await shot(page, 'auth-dark');
      await page.getByLabel('Color theme').selectOption('light');
      await shot(page, 'auth-light');
      await page.goto(origin + '/docs/quickstart', { waitUntil: 'domcontentloaded' });
      assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
      await shot(page, 'docs-light');
      await page.goto(origin);
      assert.equal(await page.locator('html').getAttribute('data-theme'), null);
    }

    if (width === 375) {
      for (const path of ['/privacy', '/docs/quickstart', '/docs/api', '/console.html']) {
        await page.goto(origin + path, { waitUntil: 'networkidle' });
        await checkViewport(page, path);
        if (path !== '/console.html') await shot(page, path.slice(1).replace('/', '-') + '-mobile');
      }
    }
    await context.close();
    console.log('Reviewed ' + width + ' × ' + height);
  }

  const staticContext = await browser.newContext({ javaScriptEnabled: false });
  const staticPage = await staticContext.newPage();
  await staticPage.goto(origin);
  await staticPage.getByText('Register an exact build, observe its execution').waitFor();
  assert.equal(await staticPage.getByRole('button', { name: '01 Register' }).count(), 0);
  for (const href of destinations) {
    const url = new URL(href);
    const result = await staticPage.request.get(url.href);
    assert.equal(result.status(), 200, href);
    if (url.hash) assert.ok((await result.text()).includes('id="' + url.hash.slice(1) + '"'), href);
  }
  await staticContext.close();

  const scrollPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await scrollPage.goto(origin);
  await scrollPage.locator('#execution').evaluate(section => window.scrollTo(0, section.offsetTop + section.offsetHeight * .56));
  await scrollPage.locator('.theater[data-stage="2"]').waitFor();
  const missing = await fetch(origin + '/unavailable-web-page');
  assert.equal(missing.status, 404);
  assert.match(await missing.text(), /This page couldn’t be found/);
  assert.deepEqual(faults, []);
  console.log(paths.length + ' public routes and ' + destinations.size + ' local link destinations passed.');
  console.log('Keyboard, mobile navigation, cross-page themes, clipboard, theater scroll and reduced motion, and JavaScript-disabled fallback passed.');
} finally {
  await browser.close();
}
