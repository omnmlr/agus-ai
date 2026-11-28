#!/usr/bin/env bash
set -euo pipefail

domain=agusai.grindcity.app
origin="https://$domain"
association="$(dirname -- "$0")/assetlinks.json"
resolve=()
if [[ $# -eq 1 ]]; then
  address=$(python3 -c 'import ipaddress,sys; print(ipaddress.IPv4Address(sys.argv[1]))' "$1")
  resolve=(--resolve "$domain:443:$address")
elif [[ $# -ne 0 ]]; then
  printf 'Usage: %s [STOCKHOLM_IPV4]\n' "$0" >&2
  exit 2
fi
fetch() { curl --silent --show-error --max-time 15 "${resolve[@]}" "$@"; }
fetch --fail "$origin/health" |
  python3 -c 'import json,sys; d=json.load(sys.stdin); assert d["ok"] is True and d["persistence"] == "postgres"'
[[ $(fetch --output /dev/null --write-out '%{http_code}' "$origin/console.html") == 200 ]]
[[ $(fetch --output /dev/null --write-out '%{http_code}' "$origin/auth/android") == 200 ]]
[[ $(fetch --output /dev/null --write-out '%{http_code}' "$origin/api/v1/projects") == 401 ]]
body=$(mktemp)
trap 'rm -f -- "$body"' EXIT
[[ $(fetch --output "$body" --write-out '%{http_code} %{content_type}' "$origin/.well-known/assetlinks.json") == '200 application/json'* ]]
python3 -c '
import json,sys
actual=json.load(sys.stdin)
with open(sys.argv[1]) as f:
    assert actual == json.load(f), "App Links association differs from signed release"
' "$association" < "$body"
curl --silent --show-error --fail --max-time 15 -o /dev/null https://agus.grindcity.app/
printf 'AGUS AI PostgreSQL, App Links, Android return, console, protected API, and financial HTTPS verified.\n'
