import { loadConfig } from "./config";
import { createLogger } from "./logger";
import { initSolana } from "./solana/connection";
import { createVaultStore } from "./database";
import { initEmailTransport } from "./notifications/email";
import { createBot } from "./bot";
import { VaultMonitor } from "./monitor";
import http from "http";
import crypto from "crypto";

function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function launchBotWithRetry(
  bot: ReturnType<typeof createBot>,
  logger: ReturnType<typeof createLogger>
): Promise<void> {
  // Telegraf polling can hit 409 if another poller is active (or if a previous
  // instance hasn't released its long-poll yet). Don't crash the whole agent.
  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    attempt += 1;
    try {
      await bot.launch();
      logger.info("Telegram bot launched");
      return;
    } catch (err: any) {
      const msg = String(err?.message || err);
      const code = err?.response?.error_code;
      const desc = err?.response?.description;

      const is409 = code === 409 || msg.includes("409") || String(desc || "").includes("409");
      const delayMs = is409 ? 65_000 : Math.min(120_000, 5_000 * attempt);

      logger.error(
        { err, attempt, delayMs, code, desc },
        "Telegram bot launch failed; will retry"
      );

      // If another poller is active, wait longer than the polling timeout to
      // allow the other getUpdates request to finish.
      await sleep(delayMs);
    }
  }
}

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
    // Safe diagnostics: no secrets are returned, only hashes/presence signals.
    // This lets us confirm env mismatches between Koyeb and Vercel quickly.
    if (url === "/healthz") {
      const tgSecret = process.env.TG_INTENT_SECRET;
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(
        JSON.stringify(
          {
            ok: true,
            now: new Date().toISOString(),
            programId: config.programId,
            solanaRpcUrlHost: (() => {
              try {
                return new URL(config.solanaRpcUrl).host;
              } catch {
                return null;
              }
            })(),
            appUrl: config.appUrl,
            tgIntentSecretSha256: tgSecret ? sha256Hex(tgSecret) : null,
          },
          null,
          2
        )
      );
      return;
    }
    res.statusCode = 404;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("not found");
  });

  server.listen(port, () => {
    logger.info({ port }, "Health server listening");
  });

  // Start bot in background with retry so transient 409s don't crash the agent.
  void launchBotWithRetry(bot, logger);

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
