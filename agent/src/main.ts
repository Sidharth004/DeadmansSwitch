import { loadConfig } from "./config";
import { createLogger } from "./logger";
import { initSolana } from "./solana/connection";
import { createVaultStore } from "./database";
import { initEmailTransport } from "./notifications/email";
import { createBot } from "./bot";
import { VaultMonitor } from "./monitor";
import http from "http";

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

  // Koyeb Free only supports Web services; expose a tiny health endpoint so the
  // platform can probe liveness and you can keep it awake via external pings.
  const port = Number(process.env.PORT || 8000);
  const server = http.createServer((req, res) => {
    const url = req.url || "/";
    if (url === "/health" || url === "/") {
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end("ok");
      return;
    }
    res.statusCode = 404;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("not found");
  });

  server.listen(port, () => {
    logger.info({ port }, "Health server listening");
  });

  // Graceful shutdown
  const shutdown = () => {
    logger.info("Shutting down...");
    server.close();
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
