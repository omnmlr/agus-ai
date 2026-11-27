#!/usr/bin/env bash
set -euo pipefail

repo=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
revision=$(git -C "$repo" rev-parse --verify "${1:-HEAD}^{commit}")
output=$(realpath -m -- "${2:-/tmp}/agus-ai-$revision")
work=$(mktemp -d)
trap 'rm -rf -- "$work"' EXIT

if [[ -e "$output" ]]; then
  printf 'Output already exists: %s\n' "$output" >&2
  exit 1
fi

mkdir "$work/src" "$work/release"
git -C "$repo" archive "$revision" | tar -x -C "$work/src"

build_args=(--platform linux/amd64 --build-arg "REVISION=$revision" -f "$work/src/deploy/Dockerfile")
if [[ -n "${CODEX_PROXY_CERT:-}" && -r "$CODEX_PROXY_CERT" ]]; then
  build_args+=(--secret "id=proxy_ca,src=$CODEX_PROXY_CERT")
fi
if [[ -n "${CODEX_ENVIRONMENT_ID:-}" && -z "${BUILDX_CONFIG:-}" ]]; then
  export BUILDX_CONFIG="$work/buildx"
fi

api_image="agus-ai-api:$revision"
web_image="agus-ai-web:$revision"
docker build "${build_args[@]}" --target api --tag "$api_image" "$work/src"
docker build "${build_args[@]}" --target web --tag "$web_image" "$work/src"
docker image save "$api_image" "$web_image" | gzip -n > "$work/release/images.tar.gz"

cp "$work/src/deploy/"{compose.yml,compose.settlement.yml,Caddyfile.route.example,runtime.env.example} "$work/release/"
printf 'AGUS_AI_API_IMAGE=%s\nAGUS_AI_WEB_IMAGE=%s\n' "$api_image" "$web_image" > "$work/release/release.env"
printf '%s\n' "$revision" > "$work/release/revision.txt"
(cd "$work/release" && sha256sum images.tar.gz compose*.yml Caddyfile.route.example runtime.env.example release.env revision.txt > SHA256SUMS.txt)
mkdir -p -- "$(dirname "$output")"
mv -T -- "$work/release" "$output"
printf 'Built AGUS AI release at %s\n' "$output"
