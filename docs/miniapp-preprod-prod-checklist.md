# Mini App Pre-Production and Production Checklist

Source guide:
- https://miniapps.farcaster.xyz/docs/getting-started

## 1. Domain and Manifest

- Serve `/.well-known/farcaster.json` over HTTPS on your API domain.
- Fill account association fields in API env:
  - `FARCASTER_HEADER`
  - `FARCASTER_PAYLOAD`
  - `FARCASTER_SIGNATURE`
- Set production URLs:
  - `PUBLIC_API_BASE_URL`
  - `MINIAPP_HOME_URL`
  - `MINIAPP_IMAGE_URL`
  - `MINIAPP_SPLASH_URL`

## 2. Web Embed Metadata

- Keep `fc:miniapp` and `fc:frame` tags in `/apps/web/index.html`.
- Ensure image/splash URLs are publicly reachable and use production CDN URLs.

## 3. Quick Auth

- Set `QUICK_AUTH_DOMAIN` to production domain.
- Set `REQUIRE_QUICK_AUTH=true` in pre-prod/prod.
- Verify authenticated actor mapping uses token subject (`fid:{sub}`).

## 4. Mailbox and Billing

- Validate DM fee schedule:
  - base 1.00 USDC
  - discount 0.10 per 100 REL staked
  - floor 0.10 USDC
- Validate inbox/thread/read endpoints with authenticated identities.

## 5. Contracts

- Compile/test/lint pass:
  - `npm run check --workspace=@deaddrop/contracts`
- Deploy to testnet:
  - `npm run deploy:sepolia --workspace=@deaddrop/contracts`
- Verify role assignments post-deploy:
  - `DEFAULT_ADMIN_ROLE`
  - `MINTER_ROLE`
  - `PAUSER_ROLE`
  - `FEE_COLLECTOR_ROLE`

## 6. Security and Release

- Node runtime for contracts: use `.nvmrc` (`22.11.0`).
- Run dependency audit and review findings before release.
- Run external contract audit before mainnet deployment.
