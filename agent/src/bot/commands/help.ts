import { Telegraf } from "telegraf";

export function setupHelpCommand(bot: Telegraf): void {
  bot.help(async (ctx) => {
    await ctx.reply(
      [
        "📖 *Dead Man's Switch*",
        "",
        "*Commands*",
        "",
        "ℹ️  `/about`",
        "What this bot is and how to use it",
        "",
        "🛠️  `/create <owner_pubkey> <warning_days> <challenge_days> <deposit_sol> <beneficiary:share[:email]> [...]`",
        "Create a vault (you will sign via link)",
        "",
        "🔗  `/start <owner_pubkey>`",
        "Link an existing vault to this chat",
        "",
        "👥  `/beneficiary <owner_pubkey> <beneficiary_pubkey> [email]`",
        "Link beneficiary chat for claim alerts",
        "",
        "📊  `/status`",
        "Show vault state and countdown",
        "",
        "✅  `/checkin`",
        "Get owner check-in signing link",
        "",
        "🏦  `/claim [owner_pubkey]`",
        "Get beneficiary claim signing link",
        "",
        "❓  `/help`",
        "Show this help message",
        "",
        "*How it works:*",
        "1. 🛠️ Create a vault with /create (you sign in your wallet)",
        "2. 🔗 Link chats: owner (/start) and beneficiaries (/beneficiary)",
        "3. 👀 The bot monitors your vault on-chain",
        "4. 🔔 You get notified when state changes",
        "5. ⏳ If you don't check in, the vault advances through:",
        "`ACTIVE -> WARNING -> CHALLENGE -> CLAIMABLE`",
      ].join("\n"),
      { parse_mode: "Markdown" }
    );
  });
}
