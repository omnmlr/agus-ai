#!/usr/bin/env bash
set -euo pipefail
sdkmanager="$(find "$ANDROID_HOME/cmdline-tools" -name sdkmanager -type f -print -quit 2>/dev/null || true)"
if [[ ! -x "$sdkmanager" ]]; then
  if [[ ! -w "$ANDROID_HOME" ]]; then
    export ANDROID_HOME="$RUNNER_TEMP/companion-sdk"
  fi
  mkdir -p "$ANDROID_HOME/cmdline-tools"
  archive="$RUNNER_TEMP/companion-commandline.zip"
  curl -fsSL https://dl.google.com/android/repository/commandlinetools-linux-16111833_latest.zip -o "$archive"
  printf 'e025545c62a8e64c7559119566a569fb1dec5f60  %s\n' "$archive" | sha1sum --check
  unzip -q "$archive" -d "$RUNNER_TEMP/companion-commandline"
  mv "$RUNNER_TEMP/companion-commandline/cmdline-tools" "$ANDROID_HOME/cmdline-tools/review"
  sdkmanager="$ANDROID_HOME/cmdline-tools/review/bin/sdkmanager"
fi
if [[ ! -e "$ANDROID_HOME/licenses/android-sdk-license" ]]; then
  (yes || true) | "$sdkmanager" --licenses >/dev/null
fi
"$sdkmanager" "$@"
printf 'ANDROID_HOME=%s\nANDROID_SDK_ROOT=%s\nAGUS_SDKMANAGER=%s\n' "$ANDROID_HOME" "$ANDROID_HOME" "$sdkmanager" >> "$GITHUB_ENV"
