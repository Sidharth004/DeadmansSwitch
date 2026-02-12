import { PublicKey } from "@solana/web3.js";
import { Program } from "@coral-xyz/anchor";
import { getVaultPda } from "./connection";
import { Logger } from "../logger";

export async function sendAdvanceState(
  program: Program,
  ownerPubkey: PublicKey,
  logger: Logger
): Promise<string> {
  const [vaultPda] = getVaultPda(ownerPubkey, program.programId);

  logger.info(
    { vault: vaultPda.toBase58(), owner: ownerPubkey.toBase58() },
    "Sending advance_state transaction"
  );

  const tx = await program.methods
    .advanceState()
    .accounts({
      vault: vaultPda,
    })
    .rpc();

  logger.info({ tx, vault: vaultPda.toBase58() }, "advance_state confirmed");
  return tx;
}
