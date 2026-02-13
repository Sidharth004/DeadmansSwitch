# Ops Status (Hackathon)

**Last updated:** 2026-02-13  
**Active branch:** `telegram-noncustodial-e2e`

This file exists to preserve operational context (deployments, runbooks, and caveats) across chat context resets.

## Deployed URLs

### Frontend (Vercel)

- Production alias: `https://deadmansswitch-frontend.vercel.app`

### Agent (Koyeb, Free plan)

- Service: `deadmansswitch`
- Health endpoint: `https://<your-koyeb-subdomain>.koyeb.app/health` (returns `ok`)

## Architecture Reminder

- **Non-custodial**: bot/agent never holds the owner or beneficiary private keys.
- Bot orchestrates end-to-end via **signed intent links**.
- Users sign transactions in wallet via frontend `/tg/*` routes.

## Telegram Bot Commands (Current)

- `/create <owner_pubkey> <warning_days> <challenge_days> <deposit_sol> <beneficiary_pubkey:share[:email]> [...]`
- `/start <owner_pubkey>` (link existing vault to owner chat)
- `/beneficiary <owner_pubkey> <beneficiary_pubkey> [email]` (link beneficiary chat for claim alerts)
- `/status`
- `/checkin` (owner signing link)
- `/claim [owner_pubkey]` (beneficiary signing link)
- `/help`

## Required Environment Variables (Names Only)

### Agent (Koyeb)

- `SOLANA_RPC_URL`
- `PROGRAM_ID`
- `AGENT_PRIVATE_KEY`
- `TELEGRAM_BOT_TOKEN`
- `TG_INTENT_SECRET`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `APP_URL` (must be the Vercel frontend URL)
- Optional email: `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_FROM`

### Frontend (Vercel)

- `NEXT_PUBLIC_SOLANA_RPC_URL`
- `NEXT_PUBLIC_PROGRAM_ID`
- `NEXT_PUBLIC_BOT_USERNAME`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `TG_INTENT_SECRET` (must match agent)

## Critical Invariants

1. `TG_INTENT_SECRET` must match between agent and frontend server.
2. `APP_URL` (agent) must point to the public frontend base URL so Telegram links work on mobile.
3. Run only **one** active Telegram bot consumer:
   - Do not run local agent + Koyeb agent + GitHub Actions cron simultaneously with the same `TELEGRAM_BOT_TOKEN`.

## Koyeb Free Plan Caveat (Keep-Alive)

Koyeb Free web services may scale down to zero. This can cause intermittent Telegram bot unresponsiveness.

Mitigation:
- Use an external uptime ping to hit `/health` every 2 to 5 minutes.
- GitHub Actions keepalive workflow is available:
  - `.github/workflows/koyeb-keepalive.yml`
  - Requires repo secret: `KOYEB_HEALTH_URL` (full URL to `/health`)

## Supabase Migrations

Latest migrations include beneficiary alert linking support:
- `supabase/migrations/20260213070000_beneficiary_alerts.sql`

Remote migration push (CLI):
- `supabase db push`

## Demo-Ready Checklist

1. Frontend reachable: open `https://deadmansswitch-frontend.vercel.app`
2. Agent healthy: open `https://<koyeb-subdomain>.koyeb.app/health` -> `ok`
3. Telegram bot responds: `/help`
4. Non-custodial E2E:
   - `/create ...` in Telegram
   - open `/tg/create` link, connect owner wallet, sign
   - `/status` shows vault
   - beneficiary DM bot and run `/beneficiary ...`
   - wait for claimable (or use short timers / devnet E2E for state transitions)
   - beneficiary uses `/claim` link and signs

## Known Warnings / Noise

- Frontend builds can warn about a dependency chain resolving `pino-pretty` (WalletConnect import chain). Build still succeeds.
- Devnet airdrops are sometimes rate-limited or return internal errors; E2E script falls back to funding from local CLI payer.
