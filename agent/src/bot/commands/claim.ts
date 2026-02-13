import crypto from "crypto";
import { Telegraf } from "telegraf";
import { PublicKey } from "@solana/web3.js";
import { Config } from "../../config";
import { VaultStore } from "../../database/vault-store";
import { SolanaContext } from "../../solana/connection";
import { fetchVaultState } from "../../solana/vault-reader";
import { Logger } from "../../logger";
import { encodeIntentPayload, signIntentPayload } from "../intent";

function randomNonce(): string {
  return crypto.randomBytes(12).toString("hex");
}

export function setupClaimCommand(
  bot: Telegraf,
  config: Config,
  store: VaultStore,
  solana: SolanaContext,
  logger: Logger
): void {
  bot.command("claim", async (ctx) => {
    const parts = ctx.message.text.trim().split(/\s+/);
    const args = parts.slice(1);
    const chatId = String(ctx.chat.id);

    const ownerAddresses: string[] = [];
    if (args.length >= 1) {
      ownerAddresses.push(args[0]);
    } else {
      const vaults = await store.getVaultsByChatId(chatId);
      ownerAddresses.push(...vaults.map((v) => v.owner_address));
    }

    if (ownerAddresses.length === 0) {
      await ctx.reply(
        "No vault context found. Use `/claim <owner_pubkey>` or link a vault first.",
        { parse_mode: "Markdown" }
      );
      return;
    }

    const links: string[] = [];
    for (const ownerAddress of ownerAddresses) {
      let ownerPubkey: PublicKey;
      try {
        ownerPubkey = new PublicKey(ownerAddress);
      } catch {
        await ctx.reply(`Invalid owner pubkey: ${ownerAddress}`);
        return;
      }

      const onChainVault = await fetchVaultState(solana.program, ownerPubkey);
      if (!onChainVault) {
        links.push(`- \`${ownerAddress.slice(0, 8)}...\`: vault not found on-chain`);
        continue;
      }

      const intent = {
        v: 1,
        t: "claim",
        ts: Date.now(),
        nonce: randomNonce(),
        ownerAddress,
        vaultPda: onChainVault.pda.toBase58(),
      };

      const payload = encodeIntentPayload(intent);
      const sig = signIntentPayload(payload, config.tgIntentSecret);
      const url =
        `${config.appUrl.replace(/\/$/, "")}` +
        `/tg/claim?payload=${encodeURIComponent(payload)}&sig=${encodeURIComponent(sig)}`;

      links.push(`- \`${ownerAddress.slice(0, 8)}...\`: ${url}`);
    }

    logger.info({ chatId, owners: ownerAddresses.length }, "Generated claim links");

    await ctx.reply(
      [
        "🏦 *Claim (signature required)*",
        "",
        "Open the link below, connect your *beneficiary* wallet, and sign the claim transaction:",
        "",
        ...links,
      ].join("\n"),
      { parse_mode: "Markdown" }
    );
  });
}
