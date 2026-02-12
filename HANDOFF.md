# Dead Man's Switch — Developer Handoff

**Date:** 2026-02-12
**Repo:** https://github.com/Sidharth004/DeadmansSwitch
**Branch:** `main` (4 commits)

---

## 1. What Has Been Built

### Phase 1: Anchor Program (COMPLETE)
A Solana smart contract implementing a dead man's switch for crypto inheritance.

- **6 instructions:** `initialize_vault`, `deposit_sol`, `check_in`, `advance_state`, `claim`, `cancel`
- **5-state machine:** Active → Warning → Challenge → Claimable → Claimed
- **Key design:** `advance_state` is permissionless (anyone can call it when timelock expires), `check_in` requires owner signature
- **Deployed to devnet** at program ID: `BbNiY9dgLi93n7a6wYB8EE2NvYwAn4nGdDv22wvEJwsJ`
- **22 passing tests** using solana-bankrun (in-memory Solana runtime)

### Phase 2: Monitoring Agent + Telegram Bot (COMPLETE)
A Node.js background agent that monitors vaults and a Telegram bot for user interaction.

- **Vault Monitor:** Polls on-chain vault state every 5 minutes, calls `advance_state` when timelock expires
- **Activity Checker:** Checks owner wallet for recent transactions every 10 minutes
- **Telegram Bot:** 4 commands (`/start`, `/status`, `/checkin`, `/help`)
- **Notifications:** Telegram messages + optional email on state transitions
- **Database:** Supabase (PostgreSQL) for vault tracking, with `InMemoryVaultStore` fallback
- **Wallet:** Uses `solana-agent-kit` `Wallet` class (hackathon requirement) wrapping a `Keypair`
- **11 passing unit tests** for the state evaluator

### Infrastructure
- **Supabase project:** `qoxlbowmlodhddntxesf` (DeadMansSwitch), tables created via migration
- **Supabase tables:** `vaults`, `beneficiaries` with RLS policies (allow-all for agent access)
- **GitHub:** Public repo, `gh` CLI authenticated as `Sidharth004`
- **Solana CLI:** Configured for devnet, wallet `2JFAust4F7Z9HUrNFGcstRLSvFQuomF8y6YhZk1tD7NS`

---

## 2. File Structure

```
DeadmansSwitch/
├── programs/dead-mans-switch/
│   ├── Cargo.toml                      # Anchor 0.31.1
│   └── src/lib.rs                      # 386 lines — the on-chain program
├── tests/
│   └── dead-mans-switch.test.ts        # 22 bankrun tests (vitest)
├── agent/                              # Phase 2 — separate package
│   ├── package.json                    # solana-agent-kit, anchor, telegraf, supabase, etc.
│   ├── tsconfig.json                   # ES2022, strict, commonjs
│   ├── vitest.config.ts
│   ├── .env.example                    # Template (no secrets)
│   ├── .env                            # ACTUAL secrets (gitignored)
│   ├── agent-keypair.json              # Agent Solana wallet (gitignored)
│   ├── src/
│   │   ├── main.ts                     # Entry point — starts monitor + bot
│   │   ├── config.ts                   # Zod-validated env config
│   │   ├── logger.ts                   # Pino logger with pino-pretty
│   │   ├── types.ts                    # VaultStateLabel, getStateLabel()
│   │   ├── idl/
│   │   │   └── dead_mans_switch.json   # Copied from target/idl/
│   │   ├── solana/
│   │   │   ├── connection.ts           # AnchorProvider + SolanaAgentKit + Wallet init
│   │   │   ├── vault-reader.ts         # Fetch + deserialize vault from chain
│   │   │   └── advance-state.ts        # Send advance_state tx
│   │   ├── monitor/
│   │   │   ├── index.ts                # VaultMonitor class — two polling loops
│   │   │   ├── state-evaluator.ts      # Pure function: can vault advance?
│   │   │   └── activity-checker.ts     # Owner wallet activity via getSignaturesForAddress
│   │   ├── bot/
│   │   │   ├── index.ts                # Telegraf bot setup
│   │   │   └── commands/
│   │   │       ├── start.ts            # /start <pubkey> — link vault
│   │   │       ├── status.ts           # /status — on-chain state + countdown
│   │   │       ├── checkin.ts          # /checkin — link to web app
│   │   │       └── help.ts            # /help — command list
│   │   ├── notifications/
│   │   │   ├── index.ts                # Unified dispatcher
│   │   │   ├── telegram.ts             # Send via Telegraf
│   │   │   ├── email.ts                # Nodemailer (optional)
│   │   │   └── templates.ts            # Message templates per state
│   │   └── database/
│   │       ├── index.ts                # Supabase client factory
│   │       ├── types.ts                # VaultRecord, BeneficiaryRecord
│   │       └── vault-store.ts          # SupabaseVaultStore + InMemoryVaultStore
│   └── tests/
│       └── state-evaluator.test.ts     # 11 unit tests
├── supabase/
│   ├── config.toml                     # Supabase CLI config (linked to project)
│   └── migrations/
│       └── 20260211111935_create_vault_tables.sql
├── target/idl/
│   └── dead_mans_switch.json           # Generated IDL
├── Anchor.toml                         # devnet config
├── Cargo.toml                          # Workspace root
├── package.json                        # Root: bankrun, vitest, anchor deps
├── vitest.config.ts                    # Root test config (60s timeout)
├── tsconfig.json                       # Root TS config
└── .gitignore
```

---

## 3. What's Working / What's Not

### Working
- Anchor program compiles and all 22 bankrun tests pass
- Program deployed to devnet at `BbNiY9dgLi93n7a6wYB8EE2NvYwAn4nGdDv22wvEJwsJ`
- Agent starts successfully (`cd agent && npm run dev`)
- Telegram bot responds to commands
- Supabase tables created and accessible via anon key
- `/start <pubkey>` links a vault in Supabase
- Monitor polls and logs vault state checks
- Agent state evaluator: 11/11 tests pass
- All code compiles with `tsc --noEmit` (zero type errors)

### Not Yet Tested End-to-End
- No vault has been created on devnet yet (needs a web UI or manual CLI call to `initialize_vault`)
- `advance_state` transaction from the agent has not been tested on devnet (agent wallet `3esKH8GxyPgCKcifkBhobMa1mCaEboGVExB5Q7vXbHSY` has devnet SOL but no vault to advance)
- Telegram notifications on state transition (untested — needs a vault to actually transition)
- Email notifications (not configured, optional)

### Known Issues
- **`solana-agent-kit` dependency hell:** The package pulls in ~1780 transitive deps (drift-labs, jito-ts, metaplex, 3land, wormhole, etc.) causing:
  - `rpc-websockets` version conflicts — fixed via `overrides` in package.json
  - `node-fetch@3` ESM-only in `@3land/listings-sdk` — fixed via `postinstall` script that replaces with v2.7.0
  - **If `npm install` is run fresh, the postinstall script must succeed** or the agent will crash with `ERR_REQUIRE_ESM`
- **`ts-node` / `tsx` cannot run the agent directly** — they try to compile `.ts` source files inside `node_modules/@solana/web3.js/src/`. The workaround is `tsc && node dist/main.js` (the current `dev` script)
- **Root-level vitest** picks up `agent/tests/` if run from project root without specifying a file path. The agent tests use `globals: true` which the root vitest config doesn't enable, so they show as "failed" in root context. Run them separately: `cd agent && npm test`

---

## 4. Where We Stopped in the Phase Plan

The original plan has 5 phases:

| Phase | Status | Notes |
|-------|--------|-------|
| **Phase 1:** Anchor Program | COMPLETE | Deployed to devnet, 22 tests passing |
| **Phase 2:** Agent System | COMPLETE | Monitor + Telegram bot + Supabase, 11 tests |
| **Phase 3:** Web Frontend | NOT STARTED | Next.js app with wallet adapter |
| **Phase 4:** Testing & Hardening | NOT STARTED | E2E tests, error handling, rate limiting |
| **Phase 5:** Deployment & Demo | NOT STARTED | Cloud hosting, demo video |

**We stopped at the end of Phase 2.** Phase 3 (Web Frontend) is next.

---

## 5. What Needs to Be Built Next

### Phase 3: Web Frontend (Next.js)
Per the original spec, this should include:
- Next.js app with `@solana/wallet-adapter-react` for wallet connection
- **Create Vault** page: configure warning/challenge periods, add beneficiaries, call `initialize_vault` + `deposit_sol`
- **Dashboard:** show vault status, countdown timer, check-in button (calls `check_in`)
- **Beneficiary Claim** page: connect wallet, call `claim` if vault is claimable
- **Telegram linking:** after vault creation, show QR code / deep link to Telegram bot with `/start <pubkey>`

### Phase 4: Testing & Hardening
- E2E test: create vault on devnet → wait for timeout → agent advances → beneficiary claims
- Error handling for RPC failures, rate limits, Supabase outages
- Rate limiting on Telegram bot commands
- Retry logic in the monitor for failed `advance_state` transactions

### Phase 5: Deployment & Demo
- Deploy agent to a cloud server (Railway, Fly.io, or similar)
- Deploy web frontend (Vercel)
- Record demo video for hackathon submission

---

## 6. Open Bugs / Issues

1. **`postinstall` fragility:** The `node-fetch` postinstall hack (`cd node_modules/@3land/listings-sdk/node_modules && rm -rf node-fetch && npm install node-fetch@2.7.0`) can fail silently if `@3land/listings-sdk` changes its dependency structure. If the agent crashes with `ERR_REQUIRE_ESM` after a fresh `npm install`, run the postinstall manually.

2. **Root vitest conflict:** Running `npx vitest run` from project root picks up both root tests (bankrun) and agent tests. The agent tests fail in root context because `describe`/`it` globals aren't enabled. This is cosmetic — run tests separately (see commands below).

3. **Agent wallet balance:** The agent wallet (`3esKH8GxyPgCKcifkBhobMa1mCaEboGVExB5Q7vXbHSY`) needs devnet SOL to pay for `advance_state` transactions. Airdrop may be rate-limited — use https://faucet.solana.com as backup.

4. **Supabase RLS policies are fully open:** The current `vaults` and `beneficiaries` tables have `USING (true) WITH CHECK (true)` RLS policies. This is fine for hackathon/devnet but must be tightened before any production use.

5. **No vault exists on-chain yet:** The Telegram bot's `/status` will report "vault not found" for any pubkey until someone calls `initialize_vault` on devnet (Phase 3 web UI or manual anchor CLI).

---

## 7. Commands to Run / Test

### Prerequisites
- Node.js v22+
- Rust + Solana CLI + Anchor CLI 0.31.1
- Solana CLI configured for devnet: `solana config set --url devnet`

### Anchor Program (Phase 1)
```bash
# Build the program
anchor build

# Run program tests (22 tests, uses solana-bankrun, no validator needed)
npx vitest run tests/dead-mans-switch.test.ts

# Deploy to devnet (needs ~3 SOL in wallet)
anchor deploy --provider.cluster devnet
```

### Agent (Phase 2)
```bash
cd agent

# Install dependencies (postinstall fixes node-fetch automatically)
npm install

# Copy and fill in environment variables
cp .env.example .env
# Edit .env with your keys (see .env.example for all vars)

# Run the agent (builds TypeScript then runs)
npm run dev

# Run agent unit tests (11 tests)
npm test

# Type-check only (no emit)
npx tsc --noEmit
```

### Supabase
```bash
# Link to project (needs SUPABASE_ACCESS_TOKEN env var)
export SUPABASE_ACCESS_TOKEN="your-token"
supabase link --project-ref qoxlbowmlodhddntxesf

# Push migrations
supabase db push
```

### Key Addresses
| What | Address |
|------|---------|
| Program ID | `BbNiY9dgLi93n7a6wYB8EE2NvYwAn4nGdDv22wvEJwsJ` |
| Owner wallet (Solana CLI) | `2JFAust4F7Z9HUrNFGcstRLSvFQuomF8y6YhZk1tD7NS` |
| Agent wallet | `3esKH8GxyPgCKcifkBhobMa1mCaEboGVExB5Q7vXbHSY` |
| Supabase project ref | `qoxlbowmlodhddntxesf` |

---

## 8. Decisions That Deviate from Original Spec

1. **`solana-agent-kit` Wallet class instead of `KeypairWallet`:** The plan referenced `KeypairWallet` from `solana-agent-kit`, but the actual export is `Wallet` from `solana-agent-kit/dist/utils/keypair`. Same functionality (wraps `Keypair`, implements `signTransaction`/`signAllTransactions`/`publicKey`), different name.

2. **`tsc && node` instead of `ts-node`/`tsx` for dev:** Both `ts-node` and `tsx` fail because `@solana/web3.js` ships `.ts` source files in `node_modules` that the runners try to compile. The dev script compiles first with `tsc` then runs with plain `node`.

3. **Supabase from day one (no in-memory-first):** The user chose to integrate Supabase immediately rather than starting with in-memory storage. `InMemoryVaultStore` still exists as a fallback but isn't the default path.

4. **RLS policies are fully permissive:** `USING (true) WITH CHECK (true)` on both tables. The agent uses the anon key, so it needs open access. This should be tightened in Phase 4 with proper auth.

5. **No `ts-mocha` for tests:** The original `Anchor.toml` references `ts-mocha` for tests, but the actual test suite uses `vitest` + `solana-bankrun` (no local validator needed). The Anchor.toml test script is unused.

6. **`node-fetch` downgrade via postinstall hack:** `@3land/listings-sdk` (transitive dep of `solana-agent-kit`) uses `require('node-fetch')` but depends on v3 (ESM-only). A `postinstall` script force-replaces it with v2.7.0 (CJS). This is brittle but necessary.

7. **Program constructor:** Anchor 0.31.1 uses `new Program(idl, provider)` where the program ID comes from the IDL's `address` field, not `new Program(idl, programId, provider)` as in older versions.
