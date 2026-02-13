# Ops Status (Hackathon)

**Last updated:** 2026-02-13  
**Active branch:** `telegram-noncustodial-e2e`

This file exists to preserve operational context (deployments, runbooks, and caveats) across chat context resets.

## Deployed URLs

### Frontend (Vercel)

- Production alias: `https://deadmansswitch-frontend.vercel.app`

### Agent (Koyeb, Free plan)

- Service: `deadmansswitch`
- Base URL: `https://nasty-mareah-sidharth-dev-580293c5.koyeb.app`
- Health endpoint: `https://nasty-mareah-sidharth-dev-580293c5.koyeb.app/health` (returns `ok`)

## Architecture Reminder

- **Non-custodial**: bot/agent never holds the owner or beneficiary private keys.
- Bot orchestrates end-to-end via **signed intent links**.
- Users sign transactions in wallet via frontend `/tg/*` routes.

## Telegram Bot Commands (Current)

- `/about` (what this bot is + quick start)
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

## Recent Operational Fixes

- Koyeb Free compatibility:
  - Agent exposes `/health` and builds from repo-root Docker context.
- Telegram stability:
  - Agent retries bot `launch()` on Telegram polling `409 Conflict` instead of crashing.
- Bot UX:
  - Improved `/help` spacing and added `/about`.

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

## Telegram End-to-End Testing Runbook (Owner + Beneficiary)

This runbook tests the full UX from both angles.

Prereqs:
- Use **two Telegram accounts** (recommended): one as **Owner**, one as **Beneficiary**.
- Ensure only **one** agent instance is running with your `TELEGRAM_BOT_TOKEN` (Koyeb OR local).

### A) Fast devnet simulation: stop at CLAIMABLE (manual claim via Telegram link)

This is the easiest way to demo the beneficiary claim flow without waiting days.

1. Run locally:
   - `cd agent`
   - `npm run e2e:devnet:claimable`
2. Desired outcome:
   - Script prints `owner`, `beneficiary`, `vault` and logs `Vault reached claimable state`
   - It then stops with message: `E2E_SKIP_CLAIM enabled; leaving vault claimable ...`
3. From Telegram:
   - Owner account: `/start <owner_pubkey>` (use the owner pubkey printed by the script)
     - Desired outcome: bot confirms the vault is linked.
   - Beneficiary account: `/beneficiary <owner_pubkey> <beneficiary_pubkey>`
     - Desired outcome: bot confirms beneficiary chat is linked for alerts.
   - Beneficiary account: `/claim <owner_pubkey>`
     - Desired outcome: bot returns a claim signing link; open it, connect the beneficiary wallet, sign; vault becomes `claimed`.

Notes:
- If you already have the vault in DB but bot says not found on-chain, you’re likely mixing cluster/program IDs (devnet vs mainnet).

### B) Fully Telegram-driven creation on devnet (non-custodial)

1. Owner account: `/create <owner_pubkey> <warning_days> <challenge_days> <deposit_sol> <beneficiary_pubkey:share>`
   - Tip: you can use `0 0` for fast testing (it will advance on the next agent poll).
2. Desired outcome:
   - Bot replies with a `/tg/create` signing link.
   - Owner opens link, connects wallet, signs initialize+deposit.
3. Owner account: `/start <owner_pubkey>`
4. Beneficiary account: `/beneficiary <owner_pubkey> <beneficiary_pubkey>`
5. Owner account: do nothing (or wait for short timers on devnet setups)
6. Desired outcome:
   - When vault reaches `claimable`, beneficiary receives an alert (Telegram if linked; email if configured).
   - Beneficiary runs `/claim <owner_pubkey>` and signs to receive funds.

## Known Warnings / Noise

- Frontend builds can warn about a dependency chain resolving `pino-pretty` (WalletConnect import chain). Build still succeeds.
- Devnet airdrops are sometimes rate-limited or return internal errors; E2E script falls back to funding from local CLI payer.
- If `https://api.devnet.solana.com` is unreachable (DNS/network), set `SOLANA_RPC_URL` to an alternate devnet RPC before running E2E.
