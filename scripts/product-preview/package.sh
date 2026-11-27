#!/usr/bin/env bash
set -euo pipefail
umask 077
repo=$(cd "$(dirname "$0")/../.." && pwd)
out=$(realpath -m -- "${1:?Pass a fresh output directory}")
: "${ANDROID_HOME:?Use Android SDK 35 with build-tools 35.0.0}"
tools="$ANDROID_HOME/build-tools/35.0.0"
mkdir -- "$out"
work=$(mktemp -d)
trap 'rm -rf -- "$work"' EXIT

cd "$repo"
(cd apps/android && ./gradlew --no-daemon testDebugUnitTest assembleDebug)
cp apps/android/app/build/outputs/apk/debug/app-debug.apk "$out/agus-companion-debug.apk"
development_pin=${AGUS_NATIVE_MANIFEST_PUBLIC_FILE:-$repo/docs/phase-2-3/evidence/release-development-manifest.public.b64}
AGUS_NATIVE_BUILD_TIER=development AGUS_NATIVE_MANIFEST_PUBLIC_FILE="$development_pin" \
  bash apps/android/native-preview/build.sh "$work/native"
cp "$work/native/runtime.apk" "$out/agus-runtime-development.apk"
cp "$work/native/fixture.apk" "$out/agus-fixture-development.apk"
cp "$work/native/partner.apk" "$out/agus-partner-development.apk"
cp "$work/native/manifest.public.b64" "$out/development-manifest-public.b64"
bash packages/mobile-test/lab/build-android.sh "$work/lab" devnet
cp "$work/lab/agus-mwa-devnet.apk" "$out/agus-dedicated-wallet-devnet.apk"

npm --prefix deploy/neon run build -- "$work/neon"
zip -q -9 -X -j "$out/agus-neon-function.zip" "$work/neon/index.mjs"
mkdir -p "$work/sdk/packages" "$work/sdk/apps/android/native-preview"
cp -r packages/cooperative-android "$work/sdk/packages/"
cp -r apps/android/native-preview/{fixture,partner} "$work/sdk/apps/android/native-preview/"
(cd "$work/sdk" && zip -q -9 -X -r "$out/agus-cooperative-sdk.zip" packages apps)
cp docs/phase-2-3/artifact-installation.md "$out/INSTALLATION.md"
cp deploy/assetlinks.json.example "$out/assetlinks.json.example"
git rev-parse HEAD > "$out/REVISION.txt"

cd "$out"
for apk in ./*.apk; do
  printf '%s\n' "${apk#./}"
  "$tools/aapt2" dump badging "$apk" | awk '/^package:/{print}'
  "$tools/apksigner" verify --print-certs "$apk" | awk '/^Signer #[0-9]+ certificate SHA-256 digest:/{print}'
done > ANDROID-SIGNERS.txt
sha256sum ./*.apk ./*.zip ./*.b64 ./*.example ./*.md REVISION.txt ANDROID-SIGNERS.txt > SHA256SUMS.txt
sha256sum --strict -c SHA256SUMS.txt
