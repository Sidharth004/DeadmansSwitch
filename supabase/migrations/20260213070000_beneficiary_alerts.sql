-- Add beneficiary Telegram chat linking and enforce per-vault beneficiary uniqueness.

ALTER TABLE beneficiaries
  ADD COLUMN IF NOT EXISTS telegram_chat_id VARCHAR(50);

-- Ensure a beneficiary address is unique per vault for safe upserts.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'beneficiaries_vault_id_address_key'
  ) THEN
    ALTER TABLE beneficiaries
      ADD CONSTRAINT beneficiaries_vault_id_address_key UNIQUE (vault_id, address);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_beneficiaries_telegram ON beneficiaries(telegram_chat_id);

