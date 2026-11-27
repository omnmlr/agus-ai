# AGUS AI deployment

The hosted control plane belongs to `omnmlr/agus-ai`. Use its dedicated Neon project, application credentials and HTTPS origin. The financial product continues to use `agus.grindcity.app`, its own stack and its own databases.

## Managed HTTPS target

The AGUS AI project is `old-fog-27608369`, in Neon `aws-eu-central-1`. Its `main` branch is `br-super-firefly-bgzy7s7x`, with database `agus_ai` and fixed 0.25 CU Postgres compute. The project sits in the existing Free organization. Functions include 10 active capacity-hours, 400 waiting capacity-hours and 1 million invocations per project per month on that plan. Both Postgres and Functions contribute to the project's shared transfer quota. [Neon plan limits](https://neon.com/docs/introduction/plans#functions)

The Function bundle serves the public site, developer console and API on the same origin. Each isolate starts the control plane on a loopback address and uses Postgres for persistent state. The isolated runtime needs Node.js 24, loopback listening and outbound TLS to Postgres and Devnet RPC. Local verification covers the bundle, TLS to an actual PostgreSQL instance, an authenticated upload and event streaming. Record the hosted readiness check separately after activation.

### Database and secret bindings

Use the `agus_ai_runtime` login with a TLS-verified URI to `agus_ai`. Keep the `agus_ai_migrations` owner connection in the operations secret store. Current startup creates its tables under `public` using the dedicated runtime role. That role needs `CONNECT` on `agus_ai` and `USAGE, CREATE` on `public` in this isolated database. Verify it has no database creation, role administration or access to the financial Neon projects. The packaged startup rejects the owner and the old financial database names.

Add deployment environment variables using the Neon console or the deployment API's secret map over HTTPS. Send the values directly from the authorized secret store. A Function deploy inherits existing values for omitted variables. Review variable names when verifying a deployment and keep values out of release files, logs and shell arguments. [Neon Function environment variables](https://neon.com/docs/compute/functions/environment-variables)

| Environment variable | Binding |
| --- | --- |
| `AGUS_DATABASE_URL` | Restricted connection to `agus_ai` as `agus_ai_runtime`, with `sslmode=verify-full`. |
| `DATABASE_URL`, `DATABASE_URL_UNPOOLED` | Override both platform defaults with the same restricted URL so an injected owner credential never reaches the isolate. The application reads only `AGUS_DATABASE_URL`. |
| `AGUS_PROVIDER_BOOTSTRAP_TOKEN` | Random app-specific enrollment token with at least 32 characters. Give it only to approved runner operators. |
| `AGUS_REGISTRATION_TOKEN` | Independent invitation token for the demo's registered accounts. Bind it while signup is limited to invited testers. |
| `AGUS_DEVNET_RPC_URL` | Optional approved Devnet RPC. The API defaults to `https://api.devnet.solana.com`. |
| `AGUS_SETTLEMENT_ENABLED` | `0` for the Function bundle. Use the EC2 packaging below with a separately mounted disposable signer for settlement. |

### Build and verify

Run from the checked-out release revision. The packaged dashboard reads its same-origin API, so its public assets need no runtime secrets.

```bash
npm ci --prefix services/control-plane --omit=dev
npm ci --prefix services/settlement --omit=dev
npm ci --prefix deploy/neon
node --test deploy/preflight.test.mjs
npm --prefix deploy/neon test
bash deploy/neon/verify-local.sh

bundle_dir=$(mktemp -d)
npm --prefix deploy/neon run build -- "$bundle_dir"
zip -q -9 -X -j "$bundle_dir/function.zip" "$bundle_dir/index.mjs"
sha256sum "$bundle_dir/function.zip"
```

Deploy `function.zip` to `old-fog-27608369` / `br-super-firefly-bgzy7s7x` using the chosen stable slug `mobileinfra` and the secret bindings above. The Get Function response supplies the authoritative `invocation_url`. The candidate from documented hostname format and compute cell is `https://br-super-firefly-bgzy7s7x-mobileinfra.compute.c-9.eu-central-1.aws.neon.tech`. Use the actual returned origin for the console, Android, CLI and MCP configurations. The expected paths are `/`, `/console.html`, `/health` and `/api/v1`. [Deploy API](https://neon.com/docs/compute/functions/deploy)

```bash
origin='https://<invocation_url-host>'
curl --fail --silent --show-error "$origin/health"
curl --fail --silent --show-error --output /dev/null "$origin/console.html"
curl --silent --show-error --output /dev/null --write-out '%{http_code}\n' "$origin/api/v1/projects"
```

Readiness should report `{"ok":true,"persistence":"postgres"}` and unauthenticated projects should return `401`. Then sign in with a disposable account, create a test project, upload a permitted build and open the run's event stream. Verify a second client can sign in and read the same project. Private invitation URLs can use `/console.html#invite/<token>` so the invitation token stays out of the HTTP request path. Android App Links require the final application ID and the corresponding verified signing certificate before publishing `/.well-known/assetlinks.json`.

For rollback, redeploy the last verified bundle and reference the existing AGUS AI runtime secrets. Check `/health` again. Reserve migrations that remove or rewrite state for a scheduled operation with a backup and an explicit roll-forward path.

## Stockholm EC2 packaging

The prior runbook identifies the existing Stockholm `t3.small` host as `i-0b608f6472205b337` in `eu-north-1`, managed with AWS Systems Manager. A read-only check returned HTTP 200 on the financial root and readiness paths. This environment has no configured AWS identity or Session Manager access, so available RAM, disk, sustained CPU headroom and the active edge route remain unverified. The financial Compose file allocates 1,430 MB of container memory limits before the host operating system. Confirm real utilisation with `free -h`, `df -h`, `docker stats --no-stream` and EC2 CPU-credit telemetry before starting the additional 416 MB stack. Keep emulators on runner machines. [Existing Stockholm runbook](https://github.com/omnmlr/hackaholics-financial-agent/blob/5ecc4d97156fc9ac94de895e76691e0ddef7a0c3/docs/agus-crypto/DEVNET_DEPLOYMENT.md)

Build the release on a workstation so compilation never consumes the shared host's memory or CPU credits. The package contains commit-scoped Linux AMD64 image tags, checksums, the dedicated Compose project and the optional settlement mount.

```bash
bash deploy/package.sh HEAD /tmp
```

In an authorized SSM session, verify the bundle in the approved transfer directory. Set up `/etc/agus-ai/runtime.env` using the environment template, mode `0600`, with a separate DB connection and enrollment token. Use the package's known image tags and explicit Compose project name.

```bash
sha256sum --check --strict SHA256SUMS.txt
sudo docker load -i images.tar.gz
sudo docker compose --project-name agus-ai --env-file release.env -f compose.yml up --detach --wait
curl --fail --silent --show-error http://127.0.0.1:4174/health
```

Only the AGUS AI web proxy publishes a host port, on loopback. Use a distinct HTTPS hostname with confirmed DNS. The example edge route reaches only `agus-ai-web` over the dedicated `agus-ai-edge` network. Use an existing TLS edge only after confirming its active configuration can add a route without interrupting financial traffic. Validate the proposed configuration on a local copy of the same edge version and check financial readiness before and after activation. The source Caddy configuration has its admin API disabled. If the live edge cannot reload gracefully, use the Neon Function origin for the demo. [Caddy reload behavior](https://caddyserver.com/docs/command-line#signals)

Both release image targets and the Compose stack passed local startup against disposable PostgreSQL over verified TLS using the restricted login. The loopback console returned 200 and unauthenticated API access returned 401. Stockholm activation still requires host access and the capacity check above.

To exercise settlement on this stack, fund a disposable Devnet operator through an authorized test-token source, prepare its Devnet test USDC token account, then mount the isolated signer file with `compose.settlement.yml`. The container runs as UID 1000 and needs read access to that file alone. Set `AGUS_SETTLEMENT_ENABLED=1` and `AGUS_SETTLEMENT_KEYPAIR_FILE=/run/agus-ai/settlement-keypair.json`. Verify the network and token mint before funding a test job.

For API or web rollback, reapply an earlier verified AGUS AI release using its files and the same isolated runtime configuration. Check the AGUS AI and financial readiness paths afterward. The Compose project does not manage the financial edge or persistence.

## Existing service access and remaining setup

- Gemini `AI_API_KEY` passed a read-only model listing. Keep any model invocation on the authorized runner and verify the selected model independently during agent evaluation.
- Firecrawl and ElevenLabs bindings exist in the managed environment. The control plane has no feature requiring either provider.
- Google OAuth, Resend and Android signing settings were not available to this workspace. Bind approved values through their existing secret stores when the corresponding integration is ready. OAuth requires the approved AGUS AI callback origin. Android release signing requires the new Android application ID and a certificate association for the chosen origin.
- GitHub's secret metadata call returned `403` from this integration. The destination listed no GitHub deployment environment during the initial audit.
- The Netlify sites API returned `401` with the configured credential. Railway has an existing empty project called `refreshing-playfulness`, with billing eligibility unverified. The Vercel account search returned only the existing financial identity project. The isolated Neon Function is the first deployment path with confirmed Free plan eligibility.
- Windows runner prerequisites and physical-device enrollment are documented in the provider runner's setup. A phone and its authorized operator are required for physical acceptance. No raw ADB port is part of the hosted package.
