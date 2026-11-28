# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim@sha256:be979e5523c76fa4d5ca4ebd3099078f220aa47ec39c48ad5b5df9314debd6eb AS api
WORKDIR /srv/agus-ai
ENV NODE_ENV=production
COPY services/settlement/package.json services/settlement/package-lock.json ./services/settlement/
COPY services/control-plane/package.json services/control-plane/package-lock.json ./services/control-plane/
RUN --mount=type=secret,id=proxy_ca,target=/run/secrets/proxy_ca,required=false \
    if test -f /run/secrets/proxy_ca; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; \
    npm ci --omit=dev --prefix services/settlement && npm ci --omit=dev --prefix services/control-plane
COPY --chown=node:node services/settlement/ ./services/settlement/
COPY --chown=node:node services/control-plane/ ./services/control-plane/
COPY --chown=node:node deploy/preflight.mjs deploy/preflight-cli.mjs ./deploy/
ARG REVISION
LABEL org.opencontainers.image.source="https://github.com/omnmlr/agus-ai" \
      org.opencontainers.image.revision="${REVISION}"
USER node
EXPOSE 8080
CMD ["sh", "-c", "node deploy/preflight-cli.mjs && exec node services/control-plane/src/start.mjs"]

FROM node:22-bookworm-slim@sha256:be979e5523c76fa4d5ca4ebd3099078f220aa47ec39c48ad5b5df9314debd6eb AS web-build
WORKDIR /src/apps/web
COPY apps/web/ ./
COPY packages/developer-client/openapi.json /src/packages/developer-client/openapi.json
COPY docs/phase-2-3/evidence/devnet-2026-11-28/receipt-private.json docs/phase-2-3/evidence/devnet-2026-11-28/sas-attestation.json /src/docs/phase-2-3/evidence/devnet-2026-11-28/
RUN npm run build

FROM caddy:2.11.2-alpine@sha256:834468128c7696cec0ceea6172f7d692daf645ae51983ca76e39da54a97c570d AS web
RUN setcap -r /usr/bin/caddy
COPY --from=web-build --chown=10001:10001 /src/apps/web/dist/ /srv/agus-ai/
COPY --chmod=644 deploy/Caddyfile /etc/caddy/Caddyfile
ARG REVISION
LABEL org.opencontainers.image.source="https://github.com/omnmlr/agus-ai" \
      org.opencontainers.image.revision="${REVISION}"
USER 10001:10001
EXPOSE 8080
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
