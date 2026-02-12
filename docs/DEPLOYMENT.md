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

## Agent Deployment (Koyeb)

Preferred hackathon path: deploy `agent/` as a Koyeb service without card details.

### Option A: Dockerfile deploy (recommended)

1. Push branch containing `agent/Dockerfile`
2. In Koyeb, create a new service from GitHub repo
3. Set service root directory to `agent`
4. Build mode: Dockerfile (auto-detected)
5. Service type: Worker (no public HTTP route needed)
6. Add environment variables from `agent/.env.example`:
- `SOLANA_RPC_URL`
- `PROGRAM_ID`
- `AGENT_PRIVATE_KEY` (base58 private key)
- `TELEGRAM_BOT_TOKEN`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- optional mail + tuning vars

7. Deploy and verify logs show:
- monitor polling loop started
- activity checker loop started
- telegram bot launch without auth errors

### Option B: Build/Run commands (no Dockerfile)

- Root directory: `agent`
- Build command: `npm ci && npm run build`
- Run command: `npm run start`

### AGENT_PRIVATE_KEY formatting

`AGENT_PRIVATE_KEY` must be base58-encoded secret key bytes.

If you only have `agent/agent-keypair.json`, convert locally:

```bash
cd agent
node -e "const fs=require('fs');const bs58=require('bs58');const k=JSON.parse(fs.readFileSync('agent-keypair.json','utf8'));console.log(bs58.encode(Uint8Array.from(k)));"
```

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
