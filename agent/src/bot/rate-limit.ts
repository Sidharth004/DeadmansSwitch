import { MiddlewareFn } from "telegraf";
import { Config } from "../config";
import { Logger } from "../logger";

export function createCommandRateLimitMiddleware(
  config: Config,
  logger: Logger
): MiddlewareFn<any> {
  const commandWindowByChat = new Map<string, number[]>();

  return async (ctx, next) => {
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
        {
          chatId,
          limit: config.botRateLimitMaxCommands,
          windowMs: config.botRateLimitWindowMs,
        },
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
  };
}
