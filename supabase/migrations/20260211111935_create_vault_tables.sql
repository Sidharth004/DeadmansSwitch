CREATE TABLE vaults (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_address VARCHAR(44) NOT NULL UNIQUE,
  vault_pda VARCHAR(44) NOT NULL,
  state VARCHAR(20) NOT NULL DEFAULT 'active',
  warning_period_days INT,
  challenge_period_days INT,
  telegram_chat_id VARCHAR(50),
  owner_email VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE beneficiaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vault_id UUID REFERENCES vaults(id) ON DELETE CASCADE,
  address VARCHAR(44) NOT NULL,
  share SMALLINT NOT NULL CHECK (share > 0 AND share <= 100),
  email VARCHAR(255),
  has_claimed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_vaults_state ON vaults(state);
CREATE INDEX idx_vaults_telegram ON vaults(telegram_chat_id);

-- Enable Row Level Security
ALTER TABLE vaults ENABLE ROW LEVEL SECURITY;
ALTER TABLE beneficiaries ENABLE ROW LEVEL SECURITY;

-- Allow the anon key to read/write vaults (agent uses anon key)
CREATE POLICY "Allow all access to vaults" ON vaults
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all access to beneficiaries" ON beneficiaries
  FOR ALL USING (true) WITH CHECK (true);
