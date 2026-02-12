import { Telegraf } from "telegraf";
import { PublicKey } from "@solana/web3.js";
import { VaultStore } from "../../database/vault-store";
import { SolanaContext, getVaultPda } from "../../solana/connection";
import { Config } from "../../config";
import { Logger } from "../../logger";

export function setupStartCommand(
  bot: Telegraf,
  store: VaultStore,
  solana: SolanaContext,
  config: Config,
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

    const [vaultPda] = getVaultPda(
      ownerPubkey,
      new PublicKey(config.programId)
    );

    const chatId = String(ctx.chat.id);

    try {
      // Upsert vault record and link telegram
      await store.upsertVault({
        owner_address: ownerAddress,
        vault_pda: vaultPda.toBase58(),
        state: "active",
        warning_period_days: null,
        challenge_period_days: null,
        telegram_chat_id: chatId,
        owner_email: null,
      });

      logger.info({ ownerAddress, chatId }, "Vault linked via /start");

      await ctx.reply(
        [
          `✅ Vault linked successfully!`,
          ``,
          `Owner: \`${ownerAddress}\``,
          `Vault PDA: \`${vaultPda.toBase58()}\``,
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
