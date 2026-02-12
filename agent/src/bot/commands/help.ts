import { Telegraf } from "telegraf";

export function setupHelpCommand(bot: Telegraf): void {
  bot.help(async (ctx) => {
    await ctx.reply(
      [
        "📖 *Dead Man's Switch Bot Commands*",
        "",
        "`/start <owner_pubkey>` — Link a vault to this chat",
        "`/status` — Show vault state & countdown",
        "`/checkin` — Get check-in link",
        "`/help` — Show this help message",
        "",
        "*How it works:*",
        "1. Link your vault with /start",
        "2. The bot monitors your vault on-chain",
        "3. You get notified when state changes",
        "4. If you don't check in, the vault advances through:",
        "   Active → Warning → Challenge → Claimable",
      ].join("\n"),
      { parse_mode: "Markdown" }
    );
  });
}
