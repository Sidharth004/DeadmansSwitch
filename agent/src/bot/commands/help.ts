import { Telegraf } from "telegraf";

export function setupHelpCommand(bot: Telegraf): void {
  bot.help(async (ctx) => {
    await ctx.reply(
      [
        "📖 *Dead Man's Switch Bot Commands*",
        "",
        "`/create <owner_pubkey> <warning_days> <challenge_days> <deposit_sol> <beneficiary:share[:email]> [...]` — Create a vault (sign via link)",
        "`/start <owner_pubkey>` — Link a vault to this chat",
        "`/beneficiary <owner_pubkey> <beneficiary_pubkey> [email]` — Link beneficiary chat for claim alerts",
        "`/status` — Show vault state & countdown",
        "`/checkin` — Get owner check-in signing link",
        "`/claim [owner_pubkey]` — Get beneficiary claim signing link",
        "`/help` — Show this help message",
        "",
        "*How it works:*",
        "1. Create a vault with /create (you sign in your wallet)",
        "2. Or link an existing vault with /start",
        "3. The bot monitors your vault on-chain",
        "4. You get notified when state changes",
        "5. If you don't check in, the vault advances through:",
        "   Active → Warning → Challenge → Claimable",
      ].join("\n"),
      { parse_mode: "Markdown" }
    );
  });
}
