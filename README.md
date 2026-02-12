# Dead Man's Switch

Trustless crypto inheritance on Solana using an Anchor program, a monitoring agent, and a Next.js app.

## Architecture

- `programs/dead-mans-switch`: Anchor program for vault state machine and claims
- `agent`: TypeScript monitor + Telegram bot + notification pipeline
- `frontend`: Next.js app for vault creation, dashboard, and beneficiary claim
- `supabase/migrations`: schema for `vaults` and `beneficiaries`

## Current Status (2026-02-13)

- Phase 1: Complete (program implemented and tested)
- Phase 2: Complete (monitoring agent + bot + notifications)
- Phase 3: Complete (frontend create/dashboard/claim)
- Phase 4: Complete (hardening, retries, bot rate limits, integration E2E script)
- Phase 5: In progress (polish + deployment/demo docs)

## Quickstart

### 1. Prerequisites

- Node.js 20+
- Rust + Solana CLI + Anchor
- Supabase project + keys

### 2. Install

```bash
npm install
cd agent && npm install
cd ../frontend && npm install
```

### 3. Program

```bash
anchor build
npx vitest run tests/dead-mans-switch.test.ts
```

### 4. Agent

```bash
cd agent
npm test
npm run dev
```

### 5. Frontend

```bash
cd frontend
npm run dev
```

## Important Commands

### Program tests

```bash
npx vitest run tests/dead-mans-switch.test.ts
```

### Agent tests + typecheck

```bash
cd agent
npm test
npx tsc --noEmit
```

### Agent accelerated devnet E2E

```bash
cd agent
npm run e2e:devnet
```

### Frontend production build

```bash
cd frontend
npm run build
```

## Environment Notes

- `agent/.env` and `frontend/.env.local` are required for full integration.
- Supabase access can be configured via anon key for app routes and service role for trusted server tasks.
- Telegram bot deep-linking in frontend uses `NEXT_PUBLIC_BOT_USERNAME`.

## Deployment, Demo, and Testing Docs

- `docs/DEPLOYMENT.md`
- `docs/DEMO_SCRIPT.md`
- `docs/FINAL_TEST_CHECKLIST.md`
