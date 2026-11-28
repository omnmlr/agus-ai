#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 2 || ! $2 =~ ^[a-f0-9]{40}$ ]]; then
  printf 'Usage: bash %s RELEASE_DIRECTORY EXPECTED_COMMIT_SHA\n' "$0" >&2
  exit 2
fi

cd -- "$1"
revision=$(<revision.txt)
if [[ $revision != "$2" ]]; then
  printf 'The staged settlement release does not match the approved revision.\n' >&2
  exit 1
fi
for name in images.tar.gz compose.yml compose.campaign-settlement.yml revision.txt release.env; do
  if ! grep -Fx "$name" < <(cut -c 67- SHA256SUMS.txt) >/dev/null; then
    printf 'Release checksum manifest is missing %s.\n' "$name" >&2
    exit 1
  fi
done
sha256sum --check --strict SHA256SUMS.txt

runtime=/etc/agus-ai/runtime.env
signer=/etc/agus-ai/campaign-operator.json
for file in "$runtime" "$signer"; do
  if [[ ! -f $file || -L $file ]]; then
    printf 'Expected a regular operator-managed file at %s.\n' "$file" >&2
    exit 1
  fi
  case "$(stat -c '%a' -- "$file")" in
    400|600) ;;
    *) printf 'Restrict %s to mode 0400 or 0600.\n' "$file" >&2; exit 1 ;;
  esac
done
if [[ $(stat -c '%u' -- "$signer") != 1000 ]]; then
  printf 'The read-only campaign operator mount must be readable by container UID 1000.\n' >&2
  exit 1
fi

api="agus-ai-api:$revision"
web="agus-ai-web:$revision"
grep -Fx "AGUS_AI_API_IMAGE=$api" release.env >/dev/null
grep -Fx "AGUS_AI_WEB_IMAGE=$web" release.env >/dev/null
for image in "$api" "$web"; do
  platform=$(docker image inspect --format '{{.Os}}/{{.Architecture}} {{index .Config.Labels "org.opencontainers.image.revision"}}' "$image")
  if [[ $platform != "linux/amd64 $revision" ]]; then
    printf 'Unexpected platform or OCI revision for %s.\n' "$image" >&2
    exit 1
  fi
done
AGUS_AI_RUNTIME_ENV="$runtime" docker compose --project-name agus-ai --env-file release.env \
  -f compose.yml -f compose.campaign-settlement.yml config --quiet

# Check the actual image's boot guards and key derivation without a network or worker process.
docker run --rm --pull=never --network none --read-only --user 1000:1000 --cap-drop ALL \
  --security-opt no-new-privileges --pids-limit 32 --memory 128m --cpus 0.25 \
  --env-file "$runtime" --env NODE_ENV=production \
  --env AGUS_CAMPAIGN_SETTLEMENT_CLUSTER=devnet --env AGUS_ENABLE_CAMPAIGN_DEVNET=1 \
  --env AGUS_CAMPAIGN_SETTLEMENT_AUTOMATIC=1 \
  --env AGUS_CAMPAIGN_SETTLEMENT_KEYPAIR_FILE=/run/agus-ai/campaign-operator.json \
  --mount "type=bind,source=$signer,target=/run/agus-ai/campaign-operator.json,readonly" \
  --entrypoint node "$api" --input-type=module -e '
    import { validateDeployment } from "./deploy/preflight.mjs";
    import { pilotConfig } from "./services/control-plane/src/pilot-policy.mjs";
    import { DEVNET, readKeypair } from "./services/settlement/chain.mjs";
    const env = process.env;
    try {
      validateDeployment(env);
      if (env.AGUS_PUBLIC_ORIGIN !== "https://agusai.grindcity.app" || env.AGUS_SETTLEMENT_ENABLED !== "0")
        throw Error();
      if (!pilotConfig(env) ||
          (env.AGUS_CAMPAIGN_SETTLEMENT_GENESIS && env.AGUS_CAMPAIGN_SETTLEMENT_GENESIS !== DEVNET.genesis) ||
          (env.AGUS_CAMPAIGN_SETTLEMENT_MINT && env.AGUS_CAMPAIGN_SETTLEMENT_MINT !== DEVNET.mint))
        throw Error();
      const operator = await readKeypair(env.AGUS_CAMPAIGN_SETTLEMENT_KEYPAIR_FILE);
      if (operator.address !== "UAEngDfn4nHQZhKj2QXRmf58WLxqnAM8F3CkKCaHhJn") throw Error();
      console.log("Pinned campaign operator, private Devnet gates, and restricted runtime binding verified offline.");
    } catch {
      console.error("Staged operator or private Devnet runtime configuration did not pass verification.");
      process.exitCode = 1;
    }'

printf 'Staged release %s passed offline settlement preflight.\n' "$revision"
