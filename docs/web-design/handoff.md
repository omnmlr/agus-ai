# Web platform handoff

Base `feature/phase-2-3-product` at `ad38c4133c03c49a2d4b9ece1bf47ffcfb2a5a0c`. Review branch `feature/premium-web-platform`. See [creative direction](creative-direction.md), [visual and browser review](verification.md), [OAuth submission package](oauth-branding.md), and [functionality matrix](functionality-matrix.md).

## Local preview

Use Node 24 and an isolated local state directory. Run these commands from the repository root in two terminals.

```bash
npm ci --prefix services/control-plane
AGUS_LOCAL_DATA_DIR="$(mktemp -d)" \
AGUS_PROVIDER_BOOTSTRAP_TOKEN="$(openssl rand -hex 32)" \
AGUS_REGISTRATION_TOKEN=local-web-preview-registration-token \
PORT=18765 npm --prefix services/control-plane start
```

```bash
WEB_PORT=4173 CONTROL_PLANE_ORIGIN=http://127.0.0.1:18765 \
npm --prefix apps/web run dev
```

Open `http://127.0.0.1:4173/` or `http://127.0.0.1:4173/console.html`. Create a disposable account using the registration token above. Use the Chromium fixture below for the fuller campaign journey with a reviewed test build and a local quote.

```bash
npm --prefix apps/web test
npm --prefix apps/web run build
WEB_PORT=4174 CONTROL_PLANE_ORIGIN=http://127.0.0.1:18765 \
npm --prefix apps/web start

AGUS_BROWSER_SCREENSHOTS="$(mktemp -d)" node scripts/product-preview/browser.mjs

browser_tools="$(mktemp -d)"
npm install --prefix "$browser_tools" playwright-core
AGUS_WEB_ORIGIN=http://127.0.0.1:4173 \
AGUS_BROWSER_SCREENSHOTS="$(mktemp -d)" \
PLAYWRIGHT_CORE_MODULE="$browser_tools/node_modules/playwright-core/index.mjs" \
node scripts/product-preview/web-visual.mjs
```

## Integration and packaging

- Edit [site.config.mjs](../../apps/web/site.config.mjs) and build again to set public presentation. `demo` leads to the restricted console, `waitlist` uses the supplied URL or an availability page, and `general` moves the same CTA to general presentation. Use approved HTTPS URLs for waitlist and companion download. `contactUrl` and `privacyContactUrl` accept approved HTTPS destinations or email links.
- The homepage and support routes are generated HTML. Caddy serves the static dist through `deploy/Dockerfile`. The Neon bundler embeds the same pages. Both serve API, callback, Android App Links and health requests through the existing control plane. Keep the `/console.html` web auth return.
- For Neon, build and test the exact review commit. Install the service dependencies first, then run the existing deployment smoke and packaging steps.

```bash
npm ci --prefix services/control-plane --omit=dev
npm ci --prefix services/settlement --omit=dev
npm ci --prefix deploy/neon
npm --prefix deploy/neon test
bash deploy/neon/verify-local.sh
bundle_dir="$(mktemp -d)"
npm --prefix deploy/neon run build -- "$bundle_dir"
zip -q -9 -X -j "$bundle_dir/agus-neon-function.zip" "$bundle_dir/index.mjs"
unzip -tq "$bundle_dir/agus-neon-function.zip"
sha256sum "$bundle_dir/agus-neon-function.zip"
```

- For Compose, run `docker build -f deploy/Dockerfile --target web -t agus-web-platform:preview .` to verify the web target or `bash deploy/package.sh HEAD /tmp` to produce the checksummed release package. Use the existing deployment runbook for the founder-authorized runtime update, release verification and rollback on either path. [Deployment runbook](../../DEPLOYMENT.md)
- After approved activation, check HTTPS status for `/`, `/privacy`, `/terms`, `/docs`, `/console.html`, `/health`, `/.well-known/assetlinks.json`, and a nonexistent path. Check projects return 401 to an unauthenticated request. Verify Google and OTP using authorized credentials and an invited account.

## Continuation checkpoint

The branch implements the approved Orbital Systems design across the website, console, public documentation, and authentication. PR [#2](https://github.com/omnmlr/agus-ai/pull/2) targets the product feature branch. The default presentation keeps restricted preview access. Verify the legal draft, approved private contact, and final public APK location with the founder before public launch. Use the OAuth package for submission after the approved HTTPS release. Google consent, live email and a fresh on-chain paid settlement are external acceptance steps.
