import { PublicKey } from "@solana/web3.js";
import { Program } from "@coral-xyz/anchor";
import BN from "bn.js";
import { getVaultPda } from "./connection";
import { VaultStateLabel, getStateLabel } from "../types";

export interface VaultData {
  owner: PublicKey;
  state: VaultStateLabel;
  rawState: Record<string, unknown>;
  warningPeriodSeconds: number;
  challengePeriodSeconds: number;
  lastCheckinTimestamp: number;
  warningTriggeredAt: number | null;
  challengeTriggeredAt: number | null;
  solBalance: BN;
  beneficiaries: Array<{
    address: PublicKey;
    share: number;
    hasClaimed: boolean;
  }>;
  bump: number;
  pda: PublicKey;
}

export async function fetchVaultState(
  program: Program,
  ownerPubkey: PublicKey
): Promise<VaultData | null> {
  const programId = program.programId;
  const [pda] = getVaultPda(ownerPubkey, programId);

  try {
    const vault = await (program.account as any).vault.fetch(pda);

    return {
      owner: vault.owner,
      state: getStateLabel(vault.state),
      rawState: vault.state,
      warningPeriodSeconds: (vault.warningPeriodSeconds as BN).toNumber(),
      challengePeriodSeconds: (vault.challengePeriodSeconds as BN).toNumber(),
      lastCheckinTimestamp: (vault.lastCheckinTimestamp as BN).toNumber(),
      warningTriggeredAt: vault.warningTriggeredAt
        ? (vault.warningTriggeredAt as BN).toNumber()
        : null,
      challengeTriggeredAt: vault.challengeTriggeredAt
        ? (vault.challengeTriggeredAt as BN).toNumber()
        : null,
      solBalance: vault.solBalance,
      beneficiaries: vault.beneficiaries.map((b: any) => ({
        address: b.address,
        share: b.share,
        hasClaimed: b.hasClaimed,
      })),
      bump: vault.bump,
      pda,
    };
  } catch (err: any) {
    if (
      err.message?.includes("Account does not exist") ||
      err.message?.includes("Could not find")
    ) {
      return null;
    }
    throw err;
  }
}
