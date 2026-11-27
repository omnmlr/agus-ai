#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
: "${ANDROID_HOME:?Set ANDROID_HOME to an SDK with platform 35 and build-tools 35.0.0}"
out="$(realpath -m "${1:?Pass a disposable build output directory}")"
tools="$ANDROID_HOME/build-tools/35.0.0"
platform="$ANDROID_HOME/platforms/android-35/android.jar"
mkdir -p "$out"
keytool -genkeypair -keystore "$out/lab.keystore" -alias lab -storepass phase1lab -keypass phase1lab \
  -dname CN=AGUS-Phase1-Lab -keyalg RSA -keysize 2048 -validity 30 -noprompt

build() {
  local module="$1" work="$out/$1"
  shift
  mkdir -p "$work/classes" "$work/dex"
  "$tools/aapt2" link -I "$platform" --manifest "$module/AndroidManifest.xml" \
    --min-sdk-version 35 --target-sdk-version 35 -o "$work/base.apk" "$@"
  local -a sources=()
  mapfile -t sources < <(find "$module" -maxdepth 1 -name '*.java' -print)
  if [[ "$module" == controller ]]; then sources+=("$out/Pins.java"); fi
  if (( ${#sources[@]} )); then
    javac --release 17 -cp "$platform" -d "$work/classes" "${sources[@]}"
    mapfile -t classes < <(find "$work/classes" -name '*.class' -print)
    "$tools/d8" --min-api 35 --lib "$platform" --output "$work/dex" "${classes[@]}"
    zip -q -j "$work/base.apk" "$work/dex/classes.dex"
  fi
  "$tools/zipalign" -f 4 "$work/base.apk" "$work/aligned.apk"
  "$tools/apksigner" sign --ks "$out/lab.keystore" --ks-pass pass:phase1lab \
    --out "$out/$module.apk" "$work/aligned.apk"
  "$tools/apksigner" verify "$out/$module.apk"
}

build fixture
build untrusted
mkdir -p "$out/assets"
cp "$out/"{fixture,untrusted}.apk "$out/assets/"
digest="$(sha256sum "$out/fixture.apk" | cut -d' ' -f1)"
printf 'package app.agus.phase1; final class Pins { static final String FIXTURE_SHA256 = "%s"; }\n' \
  "$digest" > "$out/Pins.java"
"$tools/aapt2" compile --dir controller/res -o "$out/resources.zip"
build controller -A "$out/assets" "$out/resources.zip"
