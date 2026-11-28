#!/usr/bin/env bash
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../../.." && pwd)"
: "${ANDROID_HOME:?Use a disposable Android SDK with platform 35 and build-tools 35.0.0}"
out="$(realpath -m "${1:?Pass a fresh disposable output directory}")"
mkdir -p "$out"
tools="$ANDROID_HOME/build-tools/35.0.0"
jar="$ANDROID_HOME/platforms/android-35/android.jar"
node --input-type=module - "$out" "$here" <<'JS'
import { generateKeyPairSync } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
const path = process.argv[2];
const here = process.argv[3];
const tier = process.env.AGUS_NATIVE_BUILD_TIER ?? 'development';
if (!['development', 'private-preview'].includes(tier)) throw new Error('Unsupported runtime distribution');
const hosted = tier === 'private-preview';
const packages = [...new Set((process.env.AGUS_NATIVE_APPROVED_PACKAGES ?? 'app.agus.preview.fixture,org.example.agus.checklist').split(','))];
if (packages.length > 16 || packages.some(pkg => pkg.length > 120 || !/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*){2,}$/.test(pkg))) {
  throw new Error('Supply reviewed Android package IDs only');
}
let key;
if (hosted || process.env.AGUS_NATIVE_MANIFEST_PUBLIC_FILE) {
  const { createPublicKey } = await import('node:crypto');
  const encoded = readFileSync(process.env.AGUS_NATIVE_MANIFEST_PUBLIC_FILE, 'utf8').trim();
  key = createPublicKey({ key: Buffer.from(encoded, 'base64'), format: 'der', type: 'spki' });
  if (key.asymmetricKeyDetails?.namedCurve !== 'prime256v1') throw new Error('Use the operator P-256 manifest public key');
} else {
  const keys = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  key = keys.publicKey;
  writeFileSync(path + '/manifest.pkcs8', keys.privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64'), { mode: 0o600, flag: 'wx' });
}
const text = key.export({ type: 'spki', format: 'der' }).toString('base64');
writeFileSync(path + '/manifest.public.b64', text + '\n', { flag: 'wx' });
const template = readFileSync(here + '/runtime/AndroidManifest.xml', 'utf8').replace('android:usesCleartextTraffic="true"',
  'android:usesCleartextTraffic="' + !hosted + '"');
writeFileSync(path + '/runtime-AndroidManifest.xml', template.replace('<!-- REVIEWED-WORKLOAD-PACKAGES -->',
  '<queries>' + packages.map(pkg => `<package android:name="${pkg}"/>`).join('') + '</queries>'));
for (const [name, pkg] of [['runtime', 'app.agus.runtime.preview'], ['fixture', 'app.agus.preview.fixture'], ['partner', 'org.example.agus.checklist']]) {
  writeFileSync(path + '/' + name + '-PreviewConfig.java', 'package ' + pkg
    + '; final class PreviewConfig { static final String MANIFEST_KEY = "' + text + '"; '
    + 'static final String TIER = ' + JSON.stringify(tier) + '; '
    + 'static final String ORIGIN = ' + JSON.stringify(hosted ? 'https://agusai.grindcity.app/api/v1' : 'http://10.0.2.2:18765/api/v1') + '; '
    + 'static final java.util.Set<String> REVIEWED_PACKAGES = java.util.Set.of(' + packages.map(JSON.stringify).join(', ') + '); }\n');
}
JS
if [[ ${AGUS_NATIVE_BUILD_TIER:-development} == development ]]; then
  keytool -genkeypair -keystore "$out/preview.keystore" -alias preview -storepass disposable -keypass disposable \
    -dname CN=AGUS-Preview-Only -keyalg RSA -keysize 2048 -validity 30 -noprompt
  keytool -genkeypair -keystore "$out/partner.keystore" -alias partner -storepass disposable -keypass disposable \
    -dname CN=Independent-Checklist-Preview -keyalg RSA -keysize 2048 -validity 30 -noprompt
else
  : "${AGUS_NATIVE_KEYSTORE_FILE:?Set the authorized runtime release keystore}"
  : "${AGUS_NATIVE_KEYSTORE_PASSWORD:?Set the runtime keystore password}"
  : "${AGUS_NATIVE_KEY_ALIAS:?Set the runtime key alias}"
  : "${AGUS_NATIVE_KEY_PASSWORD:?Set the runtime key password}"
fi

build() {
  local name="$1" target="$out/$1"
  local manifest="$here/$name/AndroidManifest.xml" keystore="$out/preview.keystore"
  shift
  if [[ "$name" == runtime ]]; then manifest="$out/runtime-AndroidManifest.xml"; fi
  if [[ "$name" == partner ]]; then keystore="$out/partner.keystore"; fi
  mkdir -p "$target/classes" "$target/dex" "$target/generated"
  "$tools/aapt2" link -I "$jar" --manifest "$manifest" --java "$target/generated" --min-sdk-version 35 \
    --target-sdk-version 35 -o "$target/base.apk" "$@"
  local -a resources
  mapfile -t resources < <(find "$target/generated" -name 'R.java')
  javac --release 17 -cp "$jar" -d "$target/classes" "$here/$name/"*.java \
    "$root/packages/cooperative-android/src/"*.java "$out/$name-PreviewConfig.java" "${resources[@]}"
  local -a classes
  mapfile -t classes < <(find "$target/classes" -name '*.class')
  "$tools/d8" --min-api 35 --lib "$jar" --output "$target/dex" "${classes[@]}"
  zip -q -j "$target/base.apk" "$target/dex/classes.dex"
  "$tools/zipalign" -f 4 "$target/base.apk" "$target/aligned.apk"
  if [[ ${AGUS_NATIVE_BUILD_TIER:-development} == private-preview ]]; then
    "$tools/apksigner" sign --ks "$AGUS_NATIVE_KEYSTORE_FILE" --ks-key-alias "$AGUS_NATIVE_KEY_ALIAS" \
      --ks-pass env:AGUS_NATIVE_KEYSTORE_PASSWORD --key-pass env:AGUS_NATIVE_KEY_PASSWORD --out "$out/$name.apk" "$target/aligned.apk"
  else
    "$tools/apksigner" sign --ks "$keystore" --ks-pass pass:disposable --out "$out/$name.apk" "$target/aligned.apk"
  fi
  "$tools/apksigner" verify "$out/$name.apk"
}
"$tools/aapt2" compile --dir "$here/runtime/res" -o "$out/resources.zip"
"$tools/aapt2" compile --dir "$here/../branding/res" -o "$out/brand-resources.zip"
build runtime "$out/resources.zip" "$out/brand-resources.zip"
"$tools/apksigner" verify --print-certs "$out/runtime.apk" | sed -n 's/^Signer #1 certificate SHA-256 digest: //p' > "$out/runtime-signer.txt"
if [[ ${AGUS_NATIVE_BUILD_TIER:-development} == private-preview ]]; then exit 0; fi
build fixture
build partner
"$tools/apksigner" verify --print-certs "$out/fixture.apk" | sed -n 's/^Signer #1 certificate SHA-256 digest: //p' > "$out/fixture-signer.txt"
test "$(wc -c < "$out/fixture-signer.txt")" -eq 65
"$tools/apksigner" verify --print-certs "$out/partner.apk" | sed -n 's/^Signer #1 certificate SHA-256 digest: //p' > "$out/partner-signer.txt"
test "$(wc -c < "$out/partner-signer.txt")" -eq 65
test "$(cat "$out/partner-signer.txt")" != "$(cat "$out/fixture-signer.txt")"
