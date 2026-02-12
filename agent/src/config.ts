import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const configSchema = z.object({
  // Solana
  solanaRpcUrl: z.string().url().default("https://api.devnet.solana.com"),
  programId: z.string().min(32).default("BbNiY9dgLi93n7a6wYB8EE2NvYwAn4nGdDv22wvEJwsJ"),
  agentPrivateKey: z.string().min(1, "AGENT_PRIVATE_KEY is required"),

  // Telegram
  telegramBotToken: z.string().min(1, "TELEGRAM_BOT_TOKEN is required"),

  // Supabase
  supabaseUrl: z.string().url("SUPABASE_URL must be a valid URL"),
  supabaseAnonKey: z.string().min(1, "SUPABASE_ANON_KEY is required"),

  // Email (optional)
  emailHost: z.string().optional(),
  emailPort: z.coerce.number().default(587),
  emailUser: z.string().optional(),
  emailPass: z.string().optional(),
  emailFrom: z.string().optional(),

  // App
  appUrl: z.string().url().default("http://localhost:3000"),
  logLevel: z.enum(["trace", "debug", "info", "warn", "error"]).default("info"),
  pollIntervalMs: z.coerce.number().positive().default(300_000),
  activityCheckIntervalMs: z.coerce.number().positive().default(600_000),
});

export type Config = z.infer<typeof configSchema>;

export function loadConfig(): Config {
  return configSchema.parse({
    solanaRpcUrl: process.env.SOLANA_RPC_URL,
    programId: process.env.PROGRAM_ID,
    agentPrivateKey: process.env.AGENT_PRIVATE_KEY,
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
    emailHost: process.env.EMAIL_HOST || undefined,
    emailPort: process.env.EMAIL_PORT,
    emailUser: process.env.EMAIL_USER || undefined,
    emailPass: process.env.EMAIL_PASS || undefined,
    emailFrom: process.env.EMAIL_FROM || undefined,
    appUrl: process.env.APP_URL,
    logLevel: process.env.LOG_LEVEL,
    pollIntervalMs: process.env.POLL_INTERVAL_MS,
    activityCheckIntervalMs: process.env.ACTIVITY_CHECK_INTERVAL_MS,
  });
}
