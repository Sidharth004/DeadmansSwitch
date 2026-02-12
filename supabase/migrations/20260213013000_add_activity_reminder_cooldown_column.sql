ALTER TABLE vaults
ADD COLUMN IF NOT EXISTS last_activity_reminder_at TIMESTAMPTZ;
