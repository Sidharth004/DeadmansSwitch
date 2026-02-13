import { Telegraf } from "telegraf";
import { PublicKey } from "@solana/web3.js";
import { Config } from "../../config";
import { Logger } from "../../logger";
import { VaultStore } from "../../database/vault-store";
import { SolanaContext } from "../../solana/connection";
import { fetchVaultState } from "../../solana/vault-reader";
import { encodeIntentPayload, signIntentPayload } from "../intent";
import crypto from "crypto";

function randomNonce(): string {
  return crypto.randomBytes(12).toString("hex");
}

export function setupBeneficiaryCommand(
  bot: Telegraf,
  config: Config,
  store: VaultStore,
  solana: SolanaContext,
  logger: Logger
): void {
  bot.command("beneficiary", async (ctx) => {
    const parts = ctx.message.text.trim().split(/\s+/);
    const args = parts.slice(1);

    if (args.length < 2) {
      await ctx.reply(
        [
          "👥 *Beneficiary Link*",
          "",
          "Usage:",
          "`/beneficiary <owner_pubkey> <beneficiary_pubkey> [email]`",
          "",
          "This links *your Telegram chat* to a beneficiary address so you can receive claim alerts.",
        ].join("\n"),
        { parse_mode: "Markdown" }
      );
      return;
    }

    const [ownerAddress, beneficiaryAddress, emailRaw] = args;

    let ownerPubkey: PublicKey;
    let beneficiaryPubkey: PublicKey;
    try {
      ownerPubkey = new PublicKey(ownerAddress);
      beneficiaryPubkey = new PublicKey(beneficiaryAddress);
    } catch {
      await ctx.reply("Invalid Solana address provided.");
      return;
    }

    if (emailRaw && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
      await ctx.reply("Invalid email format.");
      return;
    }

    const chatId = String(ctx.chat.id);

    try {
      const onChainVault = await fetchVaultState(solana.program, ownerPubkey);
      if (!onChainVault) {
        await ctx.reply("Vault not found on-chain for this owner.");
        return;
      }

      const benOnChain = onChainVault.beneficiaries.find(
        (b) => b.address.toBase58() === beneficiaryPubkey.toBase58()
      );
      if (!benOnChain) {
        await ctx.reply("That beneficiary address is not configured on this vault.");
        return;
      }

      // Ensure vault exists in DB (do not overwrite owner telegram_chat_id here).
      const existingVault = await store.getVaultByOwner(ownerAddress);
      const vaultRecord =
        existingVault ??
        (await store.upsertVault({
          owner_address: ownerAddress,
          vault_pda: onChainVault.pda.toBase58(),
          state: onChainVault.state,
          warning_period_days: Math.floor(onChainVault.warningPeriodSeconds / 86400),
          challenge_period_days: Math.floor(onChainVault.challengePeriodSeconds / 86400),
          telegram_chat_id: null,
          owner_email: null,
          last_activity_reminder_at: null,
        }));

      await store.upsertBeneficiaries([
        {
          vault_id: vaultRecord.id,
          address: beneficiaryAddress,
          share: benOnChain.share,
          email: emailRaw || null,
          telegram_chat_id: chatId,
          has_claimed: false,
        },
      ]);

      // Generate a signed claim link for convenience.
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

      logger.info(
        { ownerAddress, beneficiaryAddress, chatId },
        "Beneficiary linked"
      );

      await ctx.reply(
        [
          "✅ Beneficiary linked for alerts.",
          "",
          `Owner: \`${ownerAddress}\``,
          `Beneficiary: \`${beneficiaryAddress}\``,
          "",
          "When the vault becomes claimable, you'll receive a notification here.",
          "",
          `Claim link: ${url}`,
        ].join("\n"),
        { parse_mode: "Markdown" }
      );
    } catch (err) {
      logger.error({ err, ownerAddress, beneficiaryAddress }, "Beneficiary link failed");
      await ctx.reply("Failed to link beneficiary. Please try again.");
    }
  });
}

