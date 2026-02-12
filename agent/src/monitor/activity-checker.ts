import { Connection, PublicKey } from "@solana/web3.js";
import { Logger } from "../logger";

/**
 * Checks if the owner wallet has had any on-chain activity
 * within the given time window (in seconds).
 */
export async function hasRecentActivity(
  connection: Connection,
  ownerPubkey: PublicKey,
  windowSeconds: number,
  logger: Logger
): Promise<boolean> {
  try {
    const sigs = await connection.getSignaturesForAddress(ownerPubkey, {
      limit: 1,
    });

    if (sigs.length === 0) {
      return false;
    }

    const latestSig = sigs[0];
    if (!latestSig.blockTime) {
      return false;
    }

    const nowUnix = Math.floor(Date.now() / 1000);
    const age = nowUnix - latestSig.blockTime;

    logger.debug(
      {
        owner: ownerPubkey.toBase58(),
        lastTxAge: age,
        window: windowSeconds,
      },
      "Activity check"
    );

    return age < windowSeconds;
  } catch (err) {
    logger.error({ err, owner: ownerPubkey.toBase58() }, "Activity check failed");
    return false;
  }
}
