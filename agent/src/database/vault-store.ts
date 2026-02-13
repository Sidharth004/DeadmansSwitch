import { SupabaseClient } from "@supabase/supabase-js";
import { BeneficiaryRecord, VaultRecord } from "./types";
import { Logger } from "../logger";

export type UpsertBeneficiaryInput = {
  vault_id: string;
  address: string;
  share: number;
  email: string | null;
  telegram_chat_id: string | null;
  has_claimed: boolean;
};

export interface VaultStore {
  getTrackedVaults(): Promise<VaultRecord[]>;
  getVaultByOwner(ownerAddress: string): Promise<VaultRecord | null>;
  upsertVault(
    vault: Omit<VaultRecord, "id" | "created_at" | "updated_at">
  ): Promise<VaultRecord>;
  updateVaultState(ownerAddress: string, state: string): Promise<void>;
  markActivityReminderSent(ownerAddress: string, sentAtIso: string): Promise<void>;
  linkTelegram(ownerAddress: string, chatId: string): Promise<void>;
  getVaultsByChatId(chatId: string): Promise<VaultRecord[]>;

  getBeneficiariesByVaultId(vaultId: string): Promise<BeneficiaryRecord[]>;
  upsertBeneficiaries(rows: UpsertBeneficiaryInput[]): Promise<void>;
  linkBeneficiaryTelegram(vaultId: string, beneficiaryAddress: string, chatId: string): Promise<void>;
}

export class SupabaseVaultStore implements VaultStore {
  constructor(
    private supabase: SupabaseClient,
    private logger: Logger
  ) {}

  async getTrackedVaults(): Promise<VaultRecord[]> {
    const { data, error } = await this.supabase
      .from("vaults")
      .select("*")
      .neq("state", "claimed");

    if (error) throw error;
    return data ?? [];
  }

  async getVaultByOwner(ownerAddress: string): Promise<VaultRecord | null> {
    const { data, error } = await this.supabase
      .from("vaults")
      .select("*")
      .eq("owner_address", ownerAddress)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async upsertVault(
    vault: Omit<VaultRecord, "id" | "created_at" | "updated_at">
  ): Promise<VaultRecord> {
    const { data, error } = await this.supabase
      .from("vaults")
      .upsert(
        { ...vault, updated_at: new Date().toISOString() },
        { onConflict: "owner_address" }
      )
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateVaultState(ownerAddress: string, state: string): Promise<void> {
    const { error } = await this.supabase
      .from("vaults")
      .update({ state, updated_at: new Date().toISOString() })
      .eq("owner_address", ownerAddress);

    if (error) throw error;
    this.logger.info({ ownerAddress, state }, "Vault state updated in DB");
  }

  async linkTelegram(ownerAddress: string, chatId: string): Promise<void> {
    const { error } = await this.supabase
      .from("vaults")
      .update({
        telegram_chat_id: chatId,
        updated_at: new Date().toISOString(),
      })
      .eq("owner_address", ownerAddress);

    if (error) throw error;
    this.logger.info({ ownerAddress, chatId }, "Telegram linked to vault");
  }

  async markActivityReminderSent(
    ownerAddress: string,
    sentAtIso: string
  ): Promise<void> {
    const { error } = await this.supabase
      .from("vaults")
      .update({
        last_activity_reminder_at: sentAtIso,
        updated_at: new Date().toISOString(),
      })
      .eq("owner_address", ownerAddress);

    if (error) throw error;
  }

  async getVaultsByChatId(chatId: string): Promise<VaultRecord[]> {
    const { data, error } = await this.supabase
      .from("vaults")
      .select("*")
      .eq("telegram_chat_id", chatId);

    if (error) throw error;
    return data ?? [];
  }

  async getBeneficiariesByVaultId(vaultId: string): Promise<BeneficiaryRecord[]> {
    const { data, error } = await this.supabase
      .from("beneficiaries")
      .select("*")
      .eq("vault_id", vaultId)
      .order("created_at", { ascending: true });

    if (error) throw error;
    return (data as BeneficiaryRecord[]) ?? [];
  }

  async upsertBeneficiaries(rows: UpsertBeneficiaryInput[]): Promise<void> {
    if (rows.length === 0) return;
    const { error } = await this.supabase
      .from("beneficiaries")
      .upsert(rows, { onConflict: "vault_id,address" });
    if (error) throw error;
  }

  async linkBeneficiaryTelegram(vaultId: string, beneficiaryAddress: string, chatId: string): Promise<void> {
    const { error } = await this.supabase
      .from("beneficiaries")
      .update({ telegram_chat_id: chatId })
      .eq("vault_id", vaultId)
      .eq("address", beneficiaryAddress);

    if (error) throw error;
    this.logger.info({ vaultId, beneficiaryAddress, chatId }, "Telegram linked to beneficiary");
  }
}

/**
 * In-memory fallback for development/testing without Supabase.
 */
export class InMemoryVaultStore implements VaultStore {
  private vaults: Map<string, VaultRecord> = new Map();
  private beneficiaries: BeneficiaryRecord[] = [];
  private idCounter = 0;

  async getTrackedVaults(): Promise<VaultRecord[]> {
    return [...this.vaults.values()].filter((v) => v.state !== "claimed");
  }

  async getVaultByOwner(ownerAddress: string): Promise<VaultRecord | null> {
    return this.vaults.get(ownerAddress) ?? null;
  }

  async upsertVault(
    vault: Omit<VaultRecord, "id" | "created_at" | "updated_at">
  ): Promise<VaultRecord> {
    const existing = this.vaults.get(vault.owner_address);
    const record: VaultRecord = {
      id: existing?.id ?? String(++this.idCounter),
      ...vault,
      created_at: existing?.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.vaults.set(vault.owner_address, record);
    return record;
  }

  async updateVaultState(ownerAddress: string, state: string): Promise<void> {
    const record = this.vaults.get(ownerAddress);
    if (record) {
      record.state = state;
      record.updated_at = new Date().toISOString();
    }
  }

  async linkTelegram(ownerAddress: string, chatId: string): Promise<void> {
    const record = this.vaults.get(ownerAddress);
    if (record) {
      record.telegram_chat_id = chatId;
      record.updated_at = new Date().toISOString();
    }
  }

  async markActivityReminderSent(
    ownerAddress: string,
    sentAtIso: string
  ): Promise<void> {
    const record = this.vaults.get(ownerAddress);
    if (record) {
      record.last_activity_reminder_at = sentAtIso;
      record.updated_at = new Date().toISOString();
    }
  }

  async getVaultsByChatId(chatId: string): Promise<VaultRecord[]> {
    return [...this.vaults.values()].filter(
      (v) => v.telegram_chat_id === chatId
    );
  }

  async getBeneficiariesByVaultId(vaultId: string): Promise<BeneficiaryRecord[]> {
    return this.beneficiaries.filter((b) => b.vault_id === vaultId);
  }

  async upsertBeneficiaries(rows: UpsertBeneficiaryInput[]): Promise<void> {
    for (const row of rows) {
      const idx = this.beneficiaries.findIndex(
        (b) => b.vault_id === row.vault_id && b.address === row.address
      );
      const record: BeneficiaryRecord = {
        id: idx >= 0 ? this.beneficiaries[idx]!.id : String(cryptoRandomId()),
        vault_id: row.vault_id,
        address: row.address,
        share: row.share,
        email: row.email,
        telegram_chat_id: row.telegram_chat_id,
        has_claimed: row.has_claimed,
        created_at: idx >= 0 ? this.beneficiaries[idx]!.created_at : new Date().toISOString(),
      };
      if (idx >= 0) this.beneficiaries[idx] = record;
      else this.beneficiaries.push(record);
    }
  }

  async linkBeneficiaryTelegram(vaultId: string, beneficiaryAddress: string, chatId: string): Promise<void> {
    const idx = this.beneficiaries.findIndex(
      (b) => b.vault_id === vaultId && b.address === beneficiaryAddress
    );
    if (idx >= 0) {
      this.beneficiaries[idx] = {
        ...this.beneficiaries[idx]!,
        telegram_chat_id: chatId,
      };
    }
  }
}

function cryptoRandomId(): number {
  // Good enough for in-memory dev IDs.
  return Math.floor(Math.random() * 1_000_000_000);
}
