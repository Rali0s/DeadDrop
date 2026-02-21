# Railway Host Upload Guide

Preferred for Railway free/single-domain constraints: deploy as one service:

- `relay-api` only, serving API + static web from same host.

Optional: two-service split is supported, but not required.

## 1. Create Railway service

1. In Railway, create a new project from this GitHub repo.
2. Add one service `relay-api`.

## 2. Configure Build/Start commands

### relay-api

Use template: `/deploy/railway/api.railway.json`

Equivalent commands:

- Build command:
  - `npm ci && npm run build --workspace=@deaddrop/web && npm run build --workspace=@deaddrop/api`
- Start command:
  - `npm run start --workspace=@deaddrop/api`

## 3. Set environment variables

### relay-api env (single-domain)

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
- `CORS_ORIGINS`
- `ADMIN_API_KEY`
- `WAITLIST_STORAGE_PATH`
- `FARCASTER_HEADER`
- `FARCASTER_PAYLOAD`
- `FARCASTER_SIGNATURE`

## 4. Domain mapping

Use one domain for everything (example):
- `<YOUR_RAILWAY_DOMAIN>`

## 5. Verify Farcaster manifest and web

After deploy, check:
- `https://<YOUR_RAILWAY_DOMAIN>/.well-known/farcaster.json`
- `https://<YOUR_RAILWAY_DOMAIN>/.well-known/miniapp.json`

And open:
- `https://<YOUR_RAILWAY_DOMAIN>/?miniApp=true`
- `https://<YOUR_RAILWAY_DOMAIN>/` (must serve web, not `Cannot GET /`)

## 6. Final preprod checks

- DM send/read works from Mailbox tab.
- Quick Auth works and unauthenticated API calls are rejected in prod mode.
- `farcaster.json` has real account association values.
- Mini app image and splash URLs return real assets.

## 7. Waitlist ops probes

Run these after each production rollout:

```bash
curl https://<YOUR_APP_DOMAIN>/health
curl https://<YOUR_APP_DOMAIN>/v1/waitlist/stats
curl -H "x-admin-key: $ADMIN_API_KEY" https://<YOUR_APP_DOMAIN>/v1/admin/waitlist
curl -L -H "x-admin-key: $ADMIN_API_KEY" https://<YOUR_APP_DOMAIN>/v1/admin/waitlist.csv -o relay-waitlist.csv
```

Expected:
- `/health` returns `{ "ok": true }`
- `/v1/waitlist/stats` returns JSON with `signupCount` and `releaseDate`
- admin waitlist JSON/CSV return `200` (not `Cannot GET ...`, not `Admin API not configured`)
