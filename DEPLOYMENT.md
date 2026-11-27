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
| `AGUS_IDEMPOTENCY_SECRET` | Stable random app-specific secret for deriving opaque invitation tokens on valid retries. |
| `AGUS_PUBLIC_ORIGIN` | Verified HTTPS origin for domain-bound payout-wallet ownership challenge. |
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

The existing Function is `mobileinfra` on `old-fog-27608369` / `br-super-firefly-bgzy7s7x`. The permanent origin is `https://agusai.grindcity.app`. Keep the current deployment ZIP and bindings for rollback. After the founder approves the update, use the existing authorized Neon API key from the secret store. The deployment API inherits omitted bindings. The status filter avoids printing environment values. [Neon Deploy API](https://neon.com/docs/compute/functions/deploy)

```bash
function_url='https://console.neon.tech/api/v2/projects/old-fog-27608369/branches/br-super-firefly-bgzy7s7x/functions/mobileinfra'
: "${NEON_API_KEY:?Bind the approved Neon credential on the operator machine}"
unzip -tq agus-neon-function.zip
printf 'Authorization: Bearer %s\n' "$NEON_API_KEY" | \
  curl --fail-with-body --silent --show-error --header @- \
    --form 'zip=@agus-neon-function.zip;type=application/zip' \
    --form-string 'runtime=nodejs24' "$function_url/deployments" | \
  jq '{id, status, deployment_id: .deployment.id, deployment_status: .deployment.status}'
printf 'Authorization: Bearer %s\n' "$NEON_API_KEY" | \
  curl --fail-with-body --silent --show-error --header @- "$function_url" | \
  jq '{invocation_url, function_url: .function.invocation_url, status, latest_deployment: (.latest_deployment | if . then {id,status} else null end)}'
```

Confirm the new deployment is `completed` in the Neon console before checking the permanent origin. Set the approved companion fingerprint through the console as `AGUS_ANDROID_CERT_SHA256`. It must be the SHA-256 certificate of the installed release APK, in colon-delimited hexadecimal. `/.well-known/assetlinks.json` is served as JSON from this configuration. Keep both settlement switches disabled on Neon.

```bash
origin='https://agusai.grindcity.app'
curl --fail --silent --show-error "$origin/health"
curl --fail --silent --show-error --output /dev/null "$origin/console.html"
curl --silent --show-error --output /dev/null --write-out '%{http_code}\n' "$origin/api/v1/projects"
curl --fail --silent --show-error "$origin/.well-known/assetlinks.json" | jq .
```

Expect PostgreSQL health, console HTTP 200, and projects HTTP 401 without authorization. Verify the release certificate association, an invited sign-in, a permitted test project and an authenticated event stream. Restore the previous ZIP and recorded settings if readiness fails. Retain the existing Google callback `https://agusai.grindcity.app/api/v1/auth/google/callback` and web return URL `https://agusai.grindcity.app/console.html`.

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

## Private HTTPS runtime and campaign settlement

The web and companion can run with `AGUS_PRODUCT_PILOT` unset. Development mode `1` uses the loopback backend and the pinned AOSP Android 15 image. The `private-preview` mode requires production Postgres, the permanent HTTPS origin, invited registration and a nonempty list of approved person IDs. Mobile distribution continues to require the same AOSP image.

`AGUS_PILOT_MEMBER_IDS` contains the approved account UUIDs. `AGUS_PILOT_REVIEWER_IDS` contains independent reviewer UUIDs within that list. Each entry in `AGUS_NATIVE_REVIEWED_BUILDS` contains `sha256`, `packageName`, `signerSha256`, `publisherId` and an optional relative `component` such as `.TestActivity`. Use exact lowercase hex digests. Put the P-256 PKCS#8 base64 value in `AGUS_NATIVE_MANIFEST_PKCS8` through the restricted secret store. The runtime build input holds the corresponding public SPKI base64 key only.

```bash
export AGUS_NATIVE_BUILD_TIER=private-preview
export AGUS_NATIVE_MANIFEST_PUBLIC_FILE=/path/to/approved-manifest.public.b64
export AGUS_NATIVE_APPROVED_PACKAGES=app.agus.preview.fixture,org.example.agus.checklist
# Export AGUS_NATIVE_KEYSTORE_FILE, AGUS_NATIVE_KEYSTORE_PASSWORD,
# AGUS_NATIVE_KEY_ALIAS and AGUS_NATIVE_KEY_PASSWORD through the signing store.
bash apps/android/native-preview/build.sh /tmp/agus-private-runtime
"$ANDROID_HOME/build-tools/35.0.0/apksigner" verify --print-certs /tmp/agus-private-runtime/runtime.apk
```

The safest existing Devnet settlement path is a planned AGUS AI cutover to the isolated Compose service. Test the candidate against a disposable database locally first. Verify the host has spare memory, disk and CPU credits and a separate HTTPS route for `agusai.grindcity.app`. Before switching the write origin, drain existing AGUS AI work and stop its writes on Neon. Run one canonical AGUS AI control plane and one campaign reconciliation worker. The worker holds a renewable Postgres claim and reuses durable signed bytes. It only advances accepted payouts and requested refunds. The Compose application has a distinct project name, health port and read-only signer mount. The existing financial applications have separate projects, routes and databases.

```bash
# Build on an authorized workstation, or use the checksummed CI package.
bash deploy/package.sh HEAD /tmp
# Extract the distribution in its own directory on the approved host.
sha256sum --strict --check SHA256SUMS.txt
sudo docker load -i images.tar.gz
# Install /etc/agus-ai/runtime.env and /etc/agus-ai/campaign-operator.json from the approved stores.
# runtime.env must be mode 0600. The mounted signer must be readable by container UID 1000 only.
sudo docker compose --project-name agus-ai --env-file release.env \
  -f compose.yml -f compose.campaign-settlement.yml config --quiet
sudo docker compose --project-name agus-ai --env-file release.env \
  -f compose.yml -f compose.campaign-settlement.yml up --detach --wait
curl --fail --silent --show-error http://127.0.0.1:4174/health
```

Verify the isolated service through loopback, then perform the authorized AGUS AI route cutover. Check AGUS AI and financial readiness separately. Abort the cutover if the live edge requires a disruptive restart, the operator signer differs from funded quotes, or capacity does not meet the checks above. For rollback, remove the AGUS AI route and stop the Compose worker before restoring the previous Neon write origin. Preserve the PostgreSQL evidence and existing escrow state. Keep the legacy dedicated settlement signer distinct if both lanes are configured during an approved deployment. [Founder activation](docs/phase-2-3/release-candidate.md)
