# AGUS AI reference web surfaces

The public site is served at `/`. The developer console is served at `/console.html`. The public example is illustrative. Console inventory, runs, evidence, and payment data are read from the control plane.

## Local development

Use Node 24. Start the control plane using its [setup guide](../../services/control-plane/) or run a separate local control-plane instance from the repository root.

```bash
npm --prefix services/control-plane ci
AGUS_LOCAL_DATA_DIR="$(mktemp -d)" \
  AGUS_PROVIDER_BOOTSTRAP_TOKEN="$(openssl rand -hex 32)" \
  npm --prefix services/control-plane start
```

In another terminal, start the same-origin web proxy and run the web checks.

```bash
CONTROL_PLANE_ORIGIN=http://127.0.0.1:8080 npm --prefix apps/web run dev
npm --prefix apps/web test
npm --prefix apps/web run build
```

Open `http://localhost:4173`. The development server uses `WEB_HOST=127.0.0.1` and `WEB_PORT=4173` by default. APK hashing requires a secure context such as HTTPS or localhost. If signup requires a registration token, enter one supplied by the control-plane operator.

## Deployment

Serve `apps/web/dist` from the product's HTTPS origin and reverse-proxy `/api/v1/` to the separate AGUS AI control-plane service. Preserve the request path and Authorization header. If using Nginx, allow a request body larger than 35 MiB for the backend's default 25 MiB APK limit to accommodate base64 and JSON encoding. Allow `blob:` in the console's image CSP for authenticated screenshot previews. The bundled static server can also serve the generated assets with `npm --prefix apps/web start`.

## Integration

- The reference console uses email and password with a control-plane bearer session scoped to the current browser tab. Signing out revokes the server session when reachable. Optional Google and OTP integration use the backend identity contract. Cloud credentials and provider enrollment tokens never belong in the static build.
- APK upload hashes the selected file on the client and sends the binary as base64. The control plane independently checks the digest.
- Developers can send an invitation to an exact private device ID and share `/console.html#invite/<token>`. The preview server also redirects `/invite/<token>` to the fragment. Opening a link preserves it through sign-in. Explicit review and acceptance are still required. If using a production path redirect, omit access logs for the opaque code.
- Public marketplace offers use unpaid preview terms. A listed compatible device can reserve one separately. A developer can request a stop and follow the runner acknowledgement or lease expiry in the event feed.
- Run detail polls every three seconds while visible using the monotonic event cursor. Artifact downloads and inline screenshot and log previews use the authenticated, hash-verified evidence route.
- Devnet settlement is available on eligible lab runs if enabled. The console relies on an external Devnet wallet to sign funding transactions and checks the recorded backend state. Private and marketplace preview terms stay unpaid.
- See the [frontend contract](../../FRONTEND_CONTRACT.md), [typed developer client](../../packages/developer-client/), [provider runner](../../services/provider-runner/), and [local MCP lab configuration](../../docs/mobile-test/DEMO.md#mcp-registration) for the integration and device setup.
