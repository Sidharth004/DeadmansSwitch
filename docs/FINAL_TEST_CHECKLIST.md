# Final Test Checklist

## Functional

- [ ] Create vault works from frontend
- [ ] Deposit SOL works
- [ ] Owner check-in works
- [ ] Agent advances state when timeout expires
- [ ] Beneficiary claim succeeds in claimable state
- [ ] Telegram notifications arrive for transitions
- [ ] Email notifications (if configured) arrive

## Reliability

- [ ] Agent retries recover from transient RPC failures
- [ ] Bot rate limiting blocks spam and recovers cleanly
- [ ] Notification channel failures do not crash monitor loop
- [ ] Supabase temporary errors are logged and retried/fail-safe

## UX

- [ ] Loading states visible during async actions
- [ ] User-facing errors are actionable
- [ ] Success confirmations visible for create/check-in/claim
- [ ] FAQ/help page is accessible
- [ ] Layout works on mobile and desktop

## Engineering

- [ ] Program tests pass
- [ ] Agent tests pass
- [ ] Frontend build passes
- [ ] Devnet E2E flow passes (`npm run e2e:devnet` in `agent/`)
