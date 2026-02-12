import { Telegraf } from "telegraf";
import { PublicKey } from "@solana/web3.js";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { VaultStore } from "../../database/vault-store";
import { SolanaContext } from "../../solana/connection";
import { fetchVaultState } from "../../solana/vault-reader";
import { evaluateVaultState } from "../../monitor/state-evaluator";
import { Logger } from "../../logger";

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  if (seconds < 86400) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  }
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  return `${d}d ${h}h`;
}

const stateEmojis: Record<string, string> = {
  active: "🟢",
  warning: "🟡",
  challenge: "🔴",
  claimable: "🏦",
  claimed: "✅",
};

export function setupStatusCommand(
  bot: Telegraf,
  store: VaultStore,
  solana: SolanaContext,
  logger: Logger
): void {
  bot.command("status", async (ctx) => {
    const chatId = String(ctx.chat.id);
    const vaults = await store.getVaultsByChatId(chatId);

    if (vaults.length === 0) {
      await ctx.reply(
        "No vaults linked. Use `/start <owner_pubkey>` to link one.",
        { parse_mode: "Markdown" }
      );
      return;
    }

    for (const vaultRecord of vaults) {
      try {
        const ownerPubkey = new PublicKey(vaultRecord.owner_address);
        const vaultData = await fetchVaultState(solana.program, ownerPubkey);

        if (!vaultData) {
          await ctx.reply(
            `Vault for \`${vaultRecord.owner_address}\` not found on chain.`,
            { parse_mode: "Markdown" }
          );
          continue;
        }

        const nowUnix = Math.floor(Date.now() / 1000);
        const evaluation = evaluateVaultState(vaultData, nowUnix);
        const emoji = stateEmojis[evaluation.currentState] || "❓";
        const balanceSol = Number(vaultData.solBalance) / LAMPORTS_PER_SOL;

        const lines = [
          `${emoji} *Vault Status*`,
          ``,
          `State: *${evaluation.currentState.toUpperCase()}*`,
          `Balance: ${balanceSol.toFixed(4)} SOL`,
          `Owner: \`${vaultRecord.owner_address.slice(0, 8)}...\``,
        ];

        if (
          evaluation.secondsUntilAdvance != null &&
          evaluation.secondsUntilAdvance > 0
        ) {
          lines.push(
            `Next state (${evaluation.nextState}): ${formatDuration(evaluation.secondsUntilAdvance)}`
          );
        } else if (evaluation.canAdvance) {
          lines.push(`⏰ Ready to advance to *${evaluation.nextState}*`);
        }

        lines.push(
          ``,
          `Beneficiaries: ${vaultData.beneficiaries.length}`,
          `Warning period: ${formatDuration(vaultData.warningPeriodSeconds)}`,
          `Challenge period: ${formatDuration(vaultData.challengePeriodSeconds)}`
        );

        await ctx.reply(lines.join("\n"), { parse_mode: "Markdown" });
      } catch (err) {
        logger.error({ err, owner: vaultRecord.owner_address }, "Status fetch error");
        await ctx.reply(
          `Error fetching status for \`${vaultRecord.owner_address}\`.`,
          { parse_mode: "Markdown" }
        );
      }
    }
  });
}
