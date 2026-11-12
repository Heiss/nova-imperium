# syntax=docker/dockerfile:1

# Base: Node 26 (see .node-version); pnpm in the version of package.json.
FROM node:26-slim@sha256:e6bedef217677b276c591795e169840edd9096dbf13f29df8ef8d1856b8820bc AS base
WORKDIR /app
ENV CI=true
COPY package.json ./
RUN npm install --global "pnpm@$(node -p "require('./package.json').packageManager.split('@')[1]")"

# All dependencies. better-sqlite3 downloads its prebuilt binary (linux amd64
# and arm64); there is no compiler in the image, a missing binary fails the build.
# Behind a TLS-inspecting proxy, pass its CA: --secret id=ca,src=/path/ca.crt
FROM base AS deps
COPY pnpm-lock.yaml .npmrc ./
RUN --mount=type=secret,id=ca,required=false \
    if [ -f /run/secrets/ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/ca; fi; \
    pnpm install --frozen-lockfile

# The client bundle, then only the production dependencies stay.
FROM deps AS build
COPY . .
# VERSION exists from the first release on; without it the server runs as
# a development build and sends no update message (src/server/news.ts).
RUN pnpm build && pnpm prune --prod --ignore-scripts && touch VERSION

# The image that runs: no compilers, no pnpm, not root, no tests.
FROM node:26-slim@sha256:e6bedef217677b276c591795e169840edd9096dbf13f29df8ef8d1856b8820bc AS app
# Debian's security updates on top of the base image (owner, 2026-11-12): a
# fix in Debian reaches the image before the official Node image is rebuilt.
# Every release build sets OS_UPDATES (release.yml), so the layer cache never
# keeps old packages; a security hotfix of the base image changes its default
# (scripts/security-hotfix.ts).
ARG OS_UPDATES=none
RUN apt-get update --error-on=any \
 && apt-get full-upgrade -y --no-install-recommends \
 && out="$(apt-get -s full-upgrade)" \
 && if ! printf '%s\n' "$out" | grep -qx '0 upgraded, 0 newly installed, 0 to remove and 0 not upgraded.'; then printf '%s\n' "$out" >&2; echo 'Debian updates were held back.' >&2; exit 1; fi \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production \
    NOVA_HOST=0.0.0.0 \
    NOVA_PORT=8080 \
    NOVA_DATA_DIR=/data
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/src/shared ./src/shared
COPY --from=build /app/src/server ./src/server
# „Neuigkeiten“ for the players and the running version (issue #81).
COPY --from=build /app/CHANGELOG.md /app/VERSION ./
COPY docker/nova /usr/local/bin/nova
RUN find src -name '*.test.ts' -delete \
 && rm -f src/server/test-helpers.ts \
 && npm uninstall --global npm corepack > /dev/null 2>&1 || true
RUN mkdir -p /data && chown node:node /data && chmod 0755 /usr/local/bin/nova
USER node
VOLUME /data
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.NOVA_PORT||8080)+'/healthz').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
CMD ["node", "src/server/main.ts"]
