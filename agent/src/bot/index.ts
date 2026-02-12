import { Telegraf, Context } from "telegraf";
import { Config } from "../config";
import { Logger } from "../logger";
import { VaultStore } from "../database/vault-store";
import { SolanaContext } from "../solana/connection";
import { setupStartCommand } from "./commands/start";
import { setupHelpCommand } from "./commands/help";
import { setupStatusCommand } from "./commands/status";
import { setupCheckinCommand } from "./commands/checkin";

export function createBot(
  config: Config,
  logger: Logger,
  store: VaultStore,
  solana: SolanaContext
): Telegraf {
  const bot = new Telegraf(config.telegramBotToken);
  const commandWindowByChat = new Map<string, number[]>();

  bot.use((ctx, next) => {
    logger.debug(
      { from: ctx.from?.id, text: (ctx.message as any)?.text },
      "Incoming message"
    );
    return next();
  });

  bot.use(async (ctx, next) => {
    const text = (ctx.message as any)?.text as string | undefined;
    if (!text || !text.startsWith("/")) return next();

    const chatId = String(ctx.chat?.id ?? "");
    if (!chatId) return next();

    const now = Date.now();
    const windowStart = now - config.botRateLimitWindowMs;
    const timestamps = (commandWindowByChat.get(chatId) ?? []).filter(
      (timestamp) => timestamp >= windowStart
    );

    if (timestamps.length >= config.botRateLimitMaxCommands) {
      logger.warn(
        { chatId, limit: config.botRateLimitMaxCommands, windowMs: config.botRateLimitWindowMs },
        "Command rate limit exceeded"
      );
      await ctx.reply(
        "Rate limit exceeded. Please wait a moment before sending more commands."
      );
      commandWindowByChat.set(chatId, timestamps);
      return;
    }

    timestamps.push(now);
    commandWindowByChat.set(chatId, timestamps);
    return next();
  });

  setupStartCommand(bot, store, solana, logger);
  setupHelpCommand(bot);
  setupStatusCommand(bot, store, solana, logger);
  setupCheckinCommand(bot, config);

  bot.catch((err: any, ctx: Context) => {
    logger.error({ err, updateType: ctx.updateType }, "Bot error");
  });

  return bot;
}
