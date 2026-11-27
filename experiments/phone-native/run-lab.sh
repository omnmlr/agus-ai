#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$root"
: "${ANDROID_HOME:?Set ANDROID_HOME}"
out="$(realpath -m "${1:?Pass a disposable output directory}")"
mkdir -p "$out"
bash experiments/phone-native/build.sh "$out/apks" > "$out/build.log" 2>&1
env -u AGUS_DATABASE_URL -u AGUS_REGISTRATION_TOKEN NODE_ENV=development \
  AGUS_LOCAL_DATA_DIR="$(mktemp -d "$out/backend.XXXXXX")" \
  AGUS_PROVIDER_BOOTSTRAP_TOKEN="$(node -p 'require("node:crypto").randomBytes(32).toString("base64url")')" \
  AGUS_ALLOW_LEGACY_POOL=0 AGUS_SETTLEMENT_ENABLED=0 HOST=127.0.0.1 PORT=18765 \
  node services/control-plane/src/start.mjs > "$out/backend.log" 2>&1 &
backend=$!
trap 'kill "$backend" 2>/dev/null || true' EXIT
curl -sSf --retry 12 --retry-connrefused --retry-delay 1 http://127.0.0.1:18765/health >/dev/null
kill -0 "$backend"
git rev-parse HEAD > "$out/revision.txt"
sha256sum "$out/apks/"*.apk | sed 's#  .*/#  #' > "$out/apk-sha256.txt"
python3 experiments/phone-native/run-avd.py "$out/apks/controller.apk" "$out"
