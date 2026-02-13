export type VaultState = "active" | "warning" | "challenge" | "claimable" | "claimed";

export interface BeneficiaryInput {
  address: string;
  share: number;
  email?: string;
}

export interface BeneficiaryRecord {
  id: string;
  address: string;
  share: number;
  email: string | null;
  telegram_chat_id?: string | null;
  has_claimed: boolean;
}

export interface VaultRecord {
  id: string;
  owner_address: string;
  vault_pda: string;
  state: VaultState;
  warning_period_days: number | null;
  challenge_period_days: number | null;
  telegram_chat_id: string | null;
  owner_email: string | null;
  created_at: string;
  updated_at: string;
}

export interface VaultWithBeneficiaries extends VaultRecord {
  beneficiaries: BeneficiaryRecord[];
}
