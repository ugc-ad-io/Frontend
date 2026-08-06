# syntax=docker/dockerfile:1

# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 — build the React bundle
#
# Node 22 to match the local toolchain. Alpine keeps the builder small; it is
# thrown away at the end anyway, but a smaller base still pulls faster in CI.
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS build

WORKDIR /app

# Copy manifests FIRST and install before copying source. Docker caches each
# layer, so as long as package*.json are unchanged this whole install layer is
# reused — editing a component no longer triggers a full reinstall.
COPY package.json package-lock.json* ./

# npm ci (not install) — installs exactly what the lockfile pins, and fails loudly
# if the lockfile is out of sync rather than silently resolving something new.
# Falls back to install when no lockfile is committed.
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# ── CRA bakes env vars at BUILD time, not runtime ────────────────────────────
# This is the big gotcha with a containerised Create React App: REACT_APP_* are
# substituted into the bundle by webpack during `npm run build`. Setting them in
# `docker run -e` or in compose `environment:` does NOTHING — the values are
# already compiled in. They must arrive as build args, which is why they are
# declared here and not in the runtime stage.
# Rebuild the image to point the app at a different backend.
ARG REACT_APP_BACKEND_URL
ARG REACT_APP_GOOGLE_CLIENT_ID
ENV REACT_APP_BACKEND_URL=$REACT_APP_BACKEND_URL
ENV REACT_APP_GOOGLE_CLIENT_ID=$REACT_APP_GOOGLE_CLIENT_ID

# The repo's own .env sets these; keep them so a container build behaves like a
# local build (CRA treats warnings as errors in CI, which would fail the build).
ENV DISABLE_ESLINT_PLUGIN=true
ENV ESLINT_NO_DEV_ERRORS=true
ENV CI=false
# Source maps roughly double the output size and expose readable source in
# production. Flip to true if you need to debug a deployed bundle.
ENV GENERATE_SOURCEMAP=false

COPY . .

RUN npm run build


# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 — serve the static bundle
#
# Only the compiled build/ directory is carried over. Node, node_modules and the
# source tree stay behind in stage 1, so the shipped image is nginx + static
# files (tens of MB) rather than a full Node toolchain (hundreds).
# ─────────────────────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime

# Replace the stock config with the SPA-aware one (history fallback + caching).
COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=build /app/build /usr/share/nginx/html

# Run as the unprivileged nginx user rather than root. The stock image's cache
# and pid paths already belong to this user in recent nginx-alpine releases.
EXPOSE 8080

# curl isn't in nginx:alpine; wget is (busybox). Used by compose's healthcheck.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q --spider http://localhost:8080/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
