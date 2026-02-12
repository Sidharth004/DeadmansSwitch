import { createClient } from "@supabase/supabase-js";
import { Config } from "../config";
import { Logger } from "../logger";
import { SupabaseVaultStore, InMemoryVaultStore, VaultStore } from "./vault-store";

export function createVaultStore(config: Config, logger: Logger): VaultStore {
  if (config.supabaseUrl && config.supabaseAnonKey) {
    const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);
    logger.info("Using Supabase vault store");
    return new SupabaseVaultStore(supabase, logger);
  }

  logger.warn("No Supabase config — using in-memory vault store");
  return new InMemoryVaultStore();
}

export { VaultStore } from "./vault-store";
