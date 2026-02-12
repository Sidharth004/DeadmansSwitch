import { Telegraf } from "telegraf";
import { PublicKey } from "@solana/web3.js";
import { VaultStore } from "../../database/vault-store";
import { SolanaContext } from "../../solana/connection";
import { fetchVaultState } from "../../solana/vault-reader";
import { Logger } from "../../logger";

export function setupStartCommand(
  bot: Telegraf,
  store: VaultStore,
  solana: SolanaContext,
  logger: Logger
): void {
  bot.start(async (ctx) => {
    const args = ctx.message.text.split(" ").slice(1);

    if (args.length === 0) {
      await ctx.reply(
        [
          "👋 Welcome to Dead Man's Switch Bot!",
          "",
          "Link your vault with:",
          "`/start <owner_pubkey>`",
          "",
          "Commands:",
          "/help — Show all commands",
          "/status — Vault status & countdown",
          "/checkin — Check-in link",
        ].join("\n"),
        { parse_mode: "Markdown" }
      );
      return;
    }

    const ownerAddress = args[0];

    // Validate pubkey
    let ownerPubkey: PublicKey;
    try {
      ownerPubkey = new PublicKey(ownerAddress);
    } catch {
      await ctx.reply("Invalid Solana address. Please provide a valid public key.");
      return;
    }

    const chatId = String(ctx.chat.id);

    try {
      const onChainVault = await fetchVaultState(solana.program, ownerPubkey);
      if (!onChainVault) {
        await ctx.reply(
          [
            "Vault not found on-chain for this owner address.",
            "Create your vault first, then run `/start <owner_pubkey>` again.",
          ].join("\n"),
          { parse_mode: "Markdown" }
        );
        return;
      }

      // Upsert vault record and link telegram
      await store.upsertVault({
        owner_address: ownerAddress,
        vault_pda: onChainVault.pda.toBase58(),
        state: onChainVault.state,
        warning_period_days: Math.floor(onChainVault.warningPeriodSeconds / 86400),
        challenge_period_days: Math.floor(onChainVault.challengePeriodSeconds / 86400),
        telegram_chat_id: chatId,
        owner_email: null,
        last_activity_reminder_at: null,
      });

      logger.info({ ownerAddress, chatId }, "Vault linked via /start");

      await ctx.reply(
        [
          `✅ Vault linked successfully!`,
          ``,
          `Owner: \`${ownerAddress}\``,
          `Vault PDA: \`${onChainVault.pda.toBase58()}\``,
          ``,
          `I'll monitor this vault and notify you of state changes.`,
          `Use /status to check current state.`,
        ].join("\n"),
        { parse_mode: "Markdown" }
      );
    } catch (err) {
      logger.error({ err, ownerAddress }, "Failed to link vault");
      await ctx.reply("Failed to link vault. Please try again.");
    }
  });
}
