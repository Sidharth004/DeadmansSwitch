import { Telegraf } from "telegraf";

export function setupAboutCommand(bot: Telegraf): void {
  bot.command("about", async (ctx) => {
    await ctx.reply(
      [
        "*Dead Man's Switch*",
        "",
        "A non-custodial crypto inheritance system on Solana:",
        "- Funds live in an on-chain vault (PDA), not in this bot",
        "- This bot monitors vault state and sends alerts",
        "- Signing stays in your wallet via secure links",
        "",
        "*Quick start*",
        "1. Create a vault: `/create ...` (you will sign in your wallet)",
        "2. Link an existing vault: `/start <owner_pubkey>`",
        "3. Check status any time: `/status`",
        "",
        "*Beneficiaries*",
        "- Beneficiaries can link their chat for claim alerts:",
        "  `/beneficiary <owner_pubkey> <beneficiary_pubkey> [email]`",
        "",
        "*State flow*",
        "`ACTIVE -> WARNING -> CHALLENGE -> CLAIMABLE`",
        "",
        "Run `/help` for the full command list.",
      ].join("\n"),
      { parse_mode: "Markdown" }
    );
  });
}

