import { Telegraf } from "telegraf";
import { Config } from "../../config";

export function setupCheckinCommand(bot: Telegraf, config: Config): void {
  bot.command("checkin", async (ctx) => {
    await ctx.reply(
      [
        "🔑 *Check-in requires your wallet signature*",
        "",
        "The check-in transaction must be signed by the vault owner's wallet.",
        "The bot cannot do this on your behalf.",
        "",
        `🔗 [Check in via web app](${config.appUrl})`,
      ].join("\n"),
      { parse_mode: "Markdown" }
    );
  });
}
