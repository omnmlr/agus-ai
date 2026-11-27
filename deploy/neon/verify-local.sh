#!/usr/bin/env bash
set -euo pipefail

repo=$(cd "$(dirname "$0")/../.." && pwd)
work=$(mktemp -d)
container="agus-neon-smoke-$BASHPID"
cleanup() {
  docker rm -f "$container" >/dev/null 2>&1 || true
  rm -rf -- "$work"
}
trap cleanup EXIT

openssl req -x509 -newkey rsa:2048 -nodes -sha256 -days 1 -subj /CN=localhost \
  -addext subjectAltName=IP:127.0.0.1 -keyout "$work/server.key" -out "$work/server.crt" 2>/dev/null
docker run --detach --name "$container" --publish 127.0.0.1::5432 \
  --mount "type=bind,source=$work,target=/cert,readonly" \
  -e POSTGRES_DB=agus_ai -e POSTGRES_USER=agus_ai_migrations -e POSTGRES_PASSWORD=local-fixture-owner \
  postgres:16-alpine sh -ec '
    cp /cert/server.crt /cert/server.key /tmp/
    chown postgres:postgres /tmp/server.crt /tmp/server.key
    chmod 600 /tmp/server.key
    exec docker-entrypoint.sh postgres -c ssl=on -c ssl_cert_file=/tmp/server.crt -c ssl_key_file=/tmp/server.key
  ' >/dev/null

for attempt in $(seq 1 30); do
  if docker exec "$container" pg_isready -h 127.0.0.1 -U agus_ai_migrations -d agus_ai >/dev/null 2>&1; then break; fi
  sleep 1
done
docker exec -i "$container" psql -q -v ON_ERROR_STOP=1 -U agus_ai_migrations -d agus_ai <<'SQL'
CREATE ROLE agus_ai_runtime LOGIN PASSWORD 'local-fixture-only';
GRANT CONNECT ON DATABASE agus_ai TO agus_ai_runtime;
GRANT USAGE, CREATE ON SCHEMA public TO agus_ai_runtime;
SQL

bundle="$work/bundle"
npm --prefix "$repo/deploy/neon" run build -- "$bundle"
address=$(docker port "$container" 5432/tcp)
database_url="postgresql://agus_ai_runtime:local-fixture-only@$address/agus_ai?sslmode=verify-full"
AGUS_DATABASE_URL="$database_url" DATABASE_URL="$database_url" DATABASE_URL_UNPOOLED="$database_url" \
  NEON_BRANCH_ID=br-local-fixture AGUS_SETTLEMENT_ENABLED=0 \
  AGUS_PROVIDER_BOOTSTRAP_TOKEN=local-fixture-provider-bootstrap-token \
  AGUS_REGISTRATION_TOKEN=local-fixture-registration-token NODE_EXTRA_CA_CERTS="$work/server.crt" \
  node "$repo/deploy/neon/smoke.mjs" "$bundle/index.mjs"
