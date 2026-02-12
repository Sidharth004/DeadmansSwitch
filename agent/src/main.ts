import { loadConfig } from "./config";
import { createLogger } from "./logger";
import { initSolana } from "./solana/connection";
import { createVaultStore } from "./database";
import { initEmailTransport } from "./notifications/email";
import { createBot } from "./bot";
import { VaultMonitor } from "./monitor";

async function main() {
  const config = loadConfig();
  const logger = createLogger(config.logLevel);

  logger.info("Starting Dead Man's Switch Agent");

  // Init Solana context (includes SolanaAgentKit + Wallet)
  const solana = initSolana(config, logger);

  // Init database
  const store = createVaultStore(config, logger);

  // Init email (optional)
  initEmailTransport(config, logger);

  // Init Telegram bot
  const bot = createBot(config, logger, store, solana);

  // Init monitor
  const monitor = new VaultMonitor(solana, store, bot, config, logger);

  // Start monitor
  monitor.start();

  // Start bot (non-blocking)
  bot.launch();
  logger.info("Telegram bot launched");

  // Graceful shutdown
  const shutdown = () => {
    logger.info("Shutting down...");
    monitor.stop();
    bot.stop("SIGINT");
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
