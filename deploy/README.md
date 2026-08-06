# Deploying the stack

Frontend + backend + Caddy reverse proxy, in one compose stack.

```
browser ──► Caddy (:80/:443, TLS)
              ├── /api/*, /uploads/*, /docs  ──► backend  (FastAPI + uvicorn, :8000)
              └── everything else            ──► frontend (nginx serving the CRA build, :8080)
```

Only Caddy is bound to the host. The two app containers are reachable solely on
the internal `edge` network, so neither is directly exposed.

---

## Layout

The frontend and backend are separate repos. Compose builds both, so clone them
side by side:

```
/srv/
  ├── Frontend/          <- this repo (run compose from Frontend/deploy)
  └── Backend/
```

Different paths are fine — set `FRONTEND_PATH` / `BACKEND_PATH` in `.env`.

## First run

```bash
cd Frontend/deploy

cp .env.example          .env           # paths, domain, frontend build args
cp .env.backend.example  .env.backend   # backend runtime secrets
# edit both

docker compose up -d --build
docker compose ps
docker compose logs -f
```

Then visit `http://<server>` (or your domain over HTTPS).

## Going live on a domain

1. Point an `A` record at the server **before** starting Caddy — certificate
   issuance fails if the domain doesn't already resolve here.
2. Set `SITE_ADDRESS=app.example.com` in `.env` (bare domain, no scheme).
3. `docker compose up -d` — Caddy obtains and renews the certificate itself, and
   redirects HTTP to HTTPS. There is nothing else to configure.

Certificates live in the `caddy-data` volume. Keep it: deleting it forces
re-issuance and can hit Let's Encrypt rate limits.

---

## Two things that will catch you out

**1. Frontend env vars are baked in at BUILD time.**
Create React App substitutes `REACT_APP_*` into the bundle during `npm run build`.
Setting them in `environment:` or `docker run -e` does *nothing* — the values are
already compiled in. They are passed as `build.args`, so changing one needs:

```bash
docker compose build frontend && docker compose up -d frontend
```

A plain restart keeps serving the old values.

Leave `REACT_APP_BACKEND_URL` **empty** with this stack. Caddy serves the API on
the same origin under `/api`, so relative calls just work — and there is no CORS
to configure. Only set it if the backend moves to its own domain.

**2. Uploads need the volume.**
`storage.py` uses Cloudinary when configured and falls back to local disk
otherwise. The fallback writes inside the container, which is ephemeral — the
`backend-uploads` volume is what stops a redeploy wiping profile photos, logos
and creator work files. **Prefer Cloudinary in production**: the volume is tied
to one host and isn't CDN-backed.

---

## Everyday commands

```bash
docker compose logs -f backend          # follow one service
docker compose restart backend          # restart without rebuilding
docker compose build --no-cache frontend
docker compose down                     # stop (volumes survive)
docker compose down -v                  # stop AND delete volumes — destroys
                                        # uploads and TLS certs
```

Deploying a new version:

```bash
git -C /srv/Frontend pull && git -C /srv/Backend pull
docker compose up -d --build
```

## Health

Both app containers have healthchecks (`docker compose ps` shows status).
Caddy also exposes the backend's FastAPI docs at `/docs`, which is a quick way
to confirm the API is reachable through the proxy.

## Secrets

`.env` and `.env.backend` are gitignored and excluded from both build contexts,
so they are never baked into an image. Only the `.example` templates are
committed. If you rotate `JWT_SECRET`, every issued token becomes invalid and
users are signed out.

## Not included

- **MongoDB** — expected to be external (Atlas or your own). To run it in this
  stack, add a `mongo` service and set `MONGO_URL=mongodb://mongo:27017` — note
  the host is the *service name*, not `localhost`, which inside a container
  refers to the container itself.
- **Backups** — nothing here backs up the `backend-uploads` volume or your
  database.
- **CI** — images are built on the server. If you'd rather build in CI and pull
  prebuilt images, replace each `build:` block with an `image:` reference.
