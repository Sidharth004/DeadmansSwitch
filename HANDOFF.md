# Dead Man's Switch — Developer Handoff

**Last updated:** 2026-02-13  
**Recommended branch for ongoing work:** `pending-issues-severity-fixes`

---

## 1. Current Phase Status

| Phase | Status | Notes |
|---|---|---|
| Phase 1: Anchor Program | COMPLETE | Vault state machine + claims + tests are in place |
| Phase 2: Agent System | COMPLETE | Monitor, activity checker, Telegram bot, notifications, Supabase integration |
| Phase 3: Frontend | COMPLETE | Create vault, vault dashboard/check-in, beneficiary claim flows |
| Phase 4: Integration & Hardening | COMPLETE | Retry logic, notification resilience, bot rate limits, DB-backed cooldown, tests, devnet E2E script |
| Phase 5: Polish & Deploy | IN PROGRESS | FAQ/help UX and deployment/demo/checklist docs added; cloud deploy + demo recording pending |

---

## 2. What Was Added Recently

### Phase 4 hardening and tests

- Retries/backoff for monitor transaction paths
- Resilient notification fanout (channel failures do not crash monitoring)
- Telegram bot command rate limiting
- DB-backed cooldown for activity reminder notifications
- Additional tests in `agent/tests/`:
  - `retry.test.ts`
  - `bot-rate-limit.test.ts`
  - `notification-resilience.test.ts`

### Phase 4 integration E2E

- New script: `agent/src/scripts/e2e-devnet.ts`
- New npm script: `agent/package.json` -> `e2e:devnet`
- Flow covered:
  1. Generate owner + beneficiary
  2. Fund wallets (airdrop with fallback transfer from local CLI payer)
  3. Initialize + fund vault
  4. Upsert vault in Supabase
  5. Start monitor, advance to claimable
  6. Claim as beneficiary and verify final state

### Phase 5 polish/documentation

- Added frontend FAQ page: `frontend/app/faq/page.tsx`
- Added FAQ navigation on home page
- Added setup/help tips on create page
- Added project docs:
  - `README.md`
  - `docs/DEPLOYMENT.md`
  - `docs/DEMO_SCRIPT.md`
  - `docs/FINAL_TEST_CHECKLIST.md`

---

## 3. Validation Snapshot

### Recently validated

- `cd agent && npm test` -> pass (19 tests)
- `cd frontend && npm run build` -> pass (with non-blocking warning below)
- `cd agent && npm run e2e:devnet` -> pass end-to-end on devnet

### Known non-blocking warning

Frontend build may show a `pino-pretty` module resolution warning through WalletConnect dependency chain. Build still succeeds.

---

## 4. Open Issues / Risks

1. `solana-agent-kit` transitive dependency fragility remains (postinstall workaround for `node-fetch` in nested dependency graph).
2. Supabase RLS policies are permissive for hackathon/devnet and should be tightened for production.
3. Deployment is not yet executed for Phase 5 (agent host + production frontend URL).
4. Demo recording and submission assets are not yet produced.

---

## 5. What Needs To Be Done Next (Phase 5 completion)

1. Deploy agent to cloud host (Railway/Fly/VM) with secure env/wallet handling.
2. Deploy frontend to Vercel with production env vars.
3. Run post-deploy smoke test from `docs/DEPLOYMENT.md`.
4. Record demo using `docs/DEMO_SCRIPT.md`.
5. Mark off `docs/FINAL_TEST_CHECKLIST.md` against deployed environment.

---

## 6. Key Commands

```bash
# Program tests
npx vitest run tests/dead-mans-switch.test.ts

# Agent tests
cd agent && npm test

# Agent accelerated devnet integration
cd agent && npm run e2e:devnet

# Frontend production build
cd frontend && npm run build
```

---

## 7. Important Paths

- Program: `programs/dead-mans-switch/src/lib.rs`
- Agent entry: `agent/src/main.ts`
- Monitor: `agent/src/monitor/index.ts`
- Telegram bot: `agent/src/bot/index.ts`
- Notifications: `agent/src/notifications/`
- Frontend create flow: `frontend/app/create/page.tsx`
- Frontend vault dashboard: `frontend/app/vault/[id]/page.tsx`
- Frontend claim page: `frontend/app/claim/[id]/page.tsx`
- Frontend FAQ: `frontend/app/faq/page.tsx`
- Deployment docs: `docs/DEPLOYMENT.md`

