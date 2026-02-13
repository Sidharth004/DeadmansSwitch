import crypto from "crypto";
import { Telegraf } from "telegraf";
import { Config } from "../../config";
import { VaultStore } from "../../database/vault-store";
import { Logger } from "../../logger";
import { encodeIntentPayload, signIntentPayload } from "../intent";

function randomNonce(): string {
  return crypto.randomBytes(12).toString("hex");
}

export function setupCheckinCommand(
  bot: Telegraf,
  config: Config,
  store: VaultStore,
  logger: Logger
): void {
  bot.command("checkin", async (ctx) => {
    const chatId = String(ctx.chat.id);
    const vaults = await store.getVaultsByChatId(chatId);

    if (vaults.length === 0) {
      await ctx.reply("No vaults linked. Use `/start <owner_pubkey>` or `/create ...` first.", {
        parse_mode: "Markdown",
      });
      return;
    }

    const links: string[] = [];
    for (const vault of vaults) {
      const intent = {
        v: 1,
        t: "checkin",
        ts: Date.now(),
        nonce: randomNonce(),
        chatId,
        ownerAddress: vault.owner_address,
        vaultPda: vault.vault_pda,
      };

      const payload = encodeIntentPayload(intent);
      const sig = signIntentPayload(payload, config.tgIntentSecret);

      const url =
        `${config.appUrl.replace(/\/$/, "")}` +
        `/tg/checkin?payload=${encodeURIComponent(payload)}&sig=${encodeURIComponent(sig)}`;

      links.push(`- \`${vault.owner_address.slice(0, 8)}...\`: ${url}`);
    }

    logger.info({ chatId, count: vaults.length }, "Generated check-in links");

    await ctx.reply(
      [
        "🔑 *Owner Check-in (signature required)*",
        "",
        "Open the link below, connect the *owner* wallet, and sign the check-in transaction:",
        "",
        ...links,
      ].join("\n"),
      { parse_mode: "Markdown" }
    );
  });
}
