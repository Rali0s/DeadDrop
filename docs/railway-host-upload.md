# Railway Host Upload Guide

This repo is a monorepo and should be deployed to Railway as two services:

- `relay-api` (Node/Express)
- `relay-web` (Vite static preview server)

## 1. Create Railway services

1. In Railway, create a new project from this GitHub repo.
2. Add service `relay-api`.
3. Add service `relay-web`.

## 2. Configure Build/Start commands

### relay-api

Use template: `/deploy/railway/api.railway.json`

Equivalent commands:

- Build command:
  - `npm ci && npm run build --workspace=@deaddrop/api`
- Start command:
  - `npm run start --workspace=@deaddrop/api`

### relay-web

Use template: `/deploy/railway/web.railway.json`

Equivalent commands:

- Build command:
  - `npm ci && npm run build --workspace=@deaddrop/web`
- Start command:
  - `npm run start --workspace=@deaddrop/web`

## 3. Set environment variables

### relay-api env

Copy from:
- `/apps/api/.env.preprod.example` for preprod
- `/apps/api/.env.production.example` for prod

Required in production:
- `PUBLIC_API_BASE_URL`
- `MINIAPP_HOME_URL`
- `MINIAPP_IMAGE_URL`
- `MINIAPP_SPLASH_URL`
- `QUICK_AUTH_DOMAIN`
- `REQUIRE_QUICK_AUTH=true`
- `FARCASTER_HEADER`
- `FARCASTER_PAYLOAD`
- `FARCASTER_SIGNATURE`

### relay-web env

Copy from:
- `/apps/web/.env.preprod.example` for preprod
- `/apps/web/.env.production.example` for prod

Required in production:
- `VITE_API_URL`
- `VITE_MINIAPP_URL`
- `VITE_MINIAPP_IMAGE_URL`
- `VITE_MINIAPP_SPLASH_URL`

## 4. Domain mapping

Suggested:
- API: `api.relay.yourdomain.com`
- Web: `app.relay.yourdomain.com`

Then update all env URLs to match these domains.

## 5. Verify Farcaster manifest and web embed

After deploy, check:
- `https://api.relay.yourdomain.com/.well-known/farcaster.json`
- `https://api.relay.yourdomain.com/.well-known/miniapp.json`

And open:
- `https://app.relay.yourdomain.com/?miniApp=true`

## 6. Final preprod checks

- DM send/read works from Mailbox tab.
- Quick Auth works and unauthenticated API calls are rejected in prod mode.
- `farcaster.json` has real account association values.
- Mini app image and splash URLs return real assets.
