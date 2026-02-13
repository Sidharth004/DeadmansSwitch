import { Telegraf, Context } from "telegraf";
import { Config } from "../config";
import { Logger } from "../logger";
import { VaultStore } from "../database/vault-store";
import { SolanaContext } from "../solana/connection";
import { setupStartCommand } from "./commands/start";
import { setupHelpCommand } from "./commands/help";
import { setupStatusCommand } from "./commands/status";
import { setupCheckinCommand } from "./commands/checkin";
import { setupCreateCommand } from "./commands/create";
import { setupClaimCommand } from "./commands/claim";
import { setupBeneficiaryCommand } from "./commands/beneficiary";
import { setupAboutCommand } from "./commands/about";
import { createCommandRateLimitMiddleware } from "./rate-limit";

export function createBot(
  config: Config,
  logger: Logger,
  store: VaultStore,
  solana: SolanaContext
): Telegraf {
  const bot = new Telegraf(config.telegramBotToken);

  bot.use((ctx, next) => {
    logger.debug(
      { from: ctx.from?.id, text: (ctx.message as any)?.text },
      "Incoming message"
    );
    return next();
  });

  bot.use(createCommandRateLimitMiddleware(config, logger));

  setupStartCommand(bot, store, solana, logger);
  setupHelpCommand(bot);
  setupAboutCommand(bot);
  setupStatusCommand(bot, store, solana, logger);
  setupCreateCommand(bot, config, logger);
  setupCheckinCommand(bot, config, store, logger);
  setupClaimCommand(bot, config, store, solana, logger);
  setupBeneficiaryCommand(bot, config, store, solana, logger);

  bot.catch((err: any, ctx: Context) => {
    logger.error({ err, updateType: ctx.updateType }, "Bot error");
  });

  return bot;
}
