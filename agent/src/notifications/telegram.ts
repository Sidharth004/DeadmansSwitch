import { Telegraf } from "telegraf";
import { Logger } from "../logger";

export async function sendTelegramMessage(
  bot: Telegraf,
  chatId: string,
  message: string,
  logger: Logger
): Promise<void> {
  await bot.telegram.sendMessage(chatId, message, {
    parse_mode: "Markdown",
  });
  logger.debug({ chatId }, "Telegram message sent");
}
