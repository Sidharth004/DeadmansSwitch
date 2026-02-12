# Deployment Runbook

## Program (Devnet)

```bash
anchor build
anchor deploy --provider.cluster devnet
```

After deploy:
- Copy new program ID if changed
- Regenerate/copy IDL to `agent/src/idl/` and `frontend/idl/`
- Update env vars for frontend and agent

## Agent Deployment

Target: Railway/Fly.io/VM with Node.js runtime.

1. Set env vars from `agent/.env.example`
2. Ensure wallet keypair is mounted securely (not committed)
3. Start command:

```bash
npm run dev
```

4. Health checks:
- logs show monitor polling loop
- telegram bot responds to `/help`
- DB writes succeed

## Frontend Deployment (Vercel)

1. Import `frontend/` as project root
2. Add env vars:
- `NEXT_PUBLIC_SOLANA_RPC_URL`
- `NEXT_PUBLIC_PROGRAM_ID`
- `NEXT_PUBLIC_BOT_USERNAME`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

3. Build command:

```bash
npm run build
```

4. Validate:
- wallet connect works
- create vault flow persists to DB
- vault dashboard + claim pages load

## Post-Deploy Smoke Test

1. Create vault on deployed frontend
2. Confirm row appears in Supabase `vaults`
3. Trigger monitor to advance state in devnet test conditions
4. Claim as beneficiary
5. Verify Telegram notifications are received
