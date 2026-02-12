# Demo Script (2.5 to 3.5 minutes)

## 0:00 - Problem

- Crypto inheritance has a major trust and custody gap.
- Dead Man's Switch solves this with non-custodial automation.

## 0:30 - Solution Architecture

- Anchor vault program enforces custody and state transitions.
- Agent monitors activity and advances state when needed.
- Frontend handles create/dashboard/claim user flows.

## 1:00 - Live Create Flow

- Connect wallet
- Configure warning/challenge windows and beneficiaries
- Initialize vault and deposit SOL
- Show Telegram deep-link for notifications

## 1:45 - Inactivity to Claimable

- Show monitor logs advancing state (`active -> warning -> challenge -> claimable`)
- Show notification delivery (Telegram, optional email)

## 2:20 - Beneficiary Claim

- Connect beneficiary wallet
- Open claim page
- Execute claim transaction
- Show balance/state confirmation

## 2:50 - Wrap Up

- Key value: trustless inheritance without handing over private keys
- Mention stack: Anchor + TypeScript agent + Next.js + Supabase
