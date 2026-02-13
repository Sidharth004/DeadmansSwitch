export interface VaultRecord {
  id: string;
  owner_address: string;
  vault_pda: string;
  state: string;
  warning_period_days: number | null;
  challenge_period_days: number | null;
  telegram_chat_id: string | null;
  owner_email: string | null;
  last_activity_reminder_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BeneficiaryRecord {
  id: string;
  vault_id: string;
  address: string;
  share: number;
  email: string | null;
  telegram_chat_id: string | null;
  has_claimed: boolean;
  created_at: string;
}
