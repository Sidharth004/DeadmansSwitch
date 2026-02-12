import { PublicKey } from "@solana/web3.js";
import { Telegraf } from "telegraf";
import { SolanaContext } from "../solana/connection";
import { fetchVaultState } from "../solana/vault-reader";
import { sendAdvanceState } from "../solana/advance-state";
import { evaluateVaultState } from "./state-evaluator";
import { hasRecentActivity } from "./activity-checker";
import { VaultStore } from "../database/vault-store";
import { notifyStateTransition } from "../notifications";
import { Config } from "../config";
import { Logger } from "../logger";

export class VaultMonitor {
  private stateTimer: ReturnType<typeof setInterval> | null = null;
  private activityTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private solana: SolanaContext,
    private store: VaultStore,
    private bot: Telegraf,
    private config: Config,
    private logger: Logger
  ) {}

  start(): void {
    this.logger.info(
      {
        pollInterval: this.config.pollIntervalMs,
        activityInterval: this.config.activityCheckIntervalMs,
      },
      "Starting vault monitor"
    );

    // Run immediately, then on intervals
    this.checkAllVaultStates();
    this.checkAllActivity();

    this.stateTimer = setInterval(
      () => this.checkAllVaultStates(),
      this.config.pollIntervalMs
    );

    this.activityTimer = setInterval(
      () => this.checkAllActivity(),
      this.config.activityCheckIntervalMs
    );
  }

  stop(): void {
    if (this.stateTimer) clearInterval(this.stateTimer);
    if (this.activityTimer) clearInterval(this.activityTimer);
    this.logger.info("Vault monitor stopped");
  }

  private async checkAllVaultStates(): Promise<void> {
    try {
      const vaults = await this.store.getTrackedVaults();
      this.logger.info({ vaultCount: vaults.length }, "Checking vault states");

      for (const vaultRecord of vaults) {
        try {
          await this.checkSingleVault(vaultRecord.owner_address);
        } catch (err) {
          this.logger.error(
            { err, owner: vaultRecord.owner_address },
            "Error checking vault"
          );
        }
      }
    } catch (err) {
      this.logger.error({ err }, "Error fetching tracked vaults");
    }
  }

  private async checkSingleVault(ownerAddress: string): Promise<void> {
    const ownerPubkey = new PublicKey(ownerAddress);
    const vaultData = await fetchVaultState(this.solana.program, ownerPubkey);

    if (!vaultData) {
      this.logger.warn({ owner: ownerAddress }, "Vault not found on chain");
      return;
    }

    const nowUnix = Math.floor(Date.now() / 1000);
    const evaluation = evaluateVaultState(vaultData, nowUnix);

    this.logger.debug(
      {
        owner: ownerAddress,
        state: evaluation.currentState,
        canAdvance: evaluation.canAdvance,
        secondsUntil: evaluation.secondsUntilAdvance,
      },
      "Vault evaluation"
    );

    // Update DB state if it changed
    const vaultRecord = await this.store.getVaultByOwner(ownerAddress);
    if (vaultRecord && vaultRecord.state !== vaultData.state) {
      await this.store.updateVaultState(ownerAddress, vaultData.state);
    }

    if (evaluation.canAdvance) {
      this.logger.info(
        {
          owner: ownerAddress,
          from: evaluation.currentState,
          to: evaluation.nextState,
        },
        "Advancing vault state"
      );

      try {
        const tx = await sendAdvanceState(
          this.solana.program,
          ownerPubkey,
          this.logger
        );

        // Re-fetch to get new state
        const updated = await fetchVaultState(
          this.solana.program,
          ownerPubkey
        );
        if (updated && vaultRecord) {
          await this.store.updateVaultState(ownerAddress, updated.state);
          await notifyStateTransition(
            updated.state,
            vaultRecord,
            this.bot,
            this.config,
            this.logger
          );
        }
      } catch (err) {
        this.logger.error(
          { err, owner: ownerAddress },
          "Failed to advance vault state"
        );
      }
    }
  }

  private async checkAllActivity(): Promise<void> {
    try {
      const vaults = await this.store.getTrackedVaults();

      for (const vaultRecord of vaults) {
        if (
          vaultRecord.state !== "active" &&
          vaultRecord.state !== "warning" &&
          vaultRecord.state !== "challenge"
        ) {
          continue;
        }

        try {
          const ownerPubkey = new PublicKey(vaultRecord.owner_address);
          const active = await hasRecentActivity(
            this.solana.connection,
            ownerPubkey,
            this.config.activityCheckIntervalMs / 1000,
            this.logger
          );

          if (active) {
            this.logger.info(
              { owner: vaultRecord.owner_address },
              "Owner wallet activity detected"
            );

            if (
              (vaultRecord.state === "warning" || vaultRecord.state === "challenge") &&
              vaultRecord.telegram_chat_id
            ) {
              try {
                await this.bot.telegram.sendMessage(
                  vaultRecord.telegram_chat_id,
                  [
                    "Recent wallet activity detected.",
                    "Your vault is still not active on-chain.",
                    `Please check in now: ${this.config.appUrl}`,
                  ].join("\n")
                );
              } catch (err) {
                this.logger.error(
                  { err, owner: vaultRecord.owner_address },
                  "Failed to send activity-based check-in reminder"
                );
              }
            }
          }
        } catch (err) {
          this.logger.error(
            { err, owner: vaultRecord.owner_address },
            "Activity check error"
          );
        }
      }
    } catch (err) {
      this.logger.error({ err }, "Error in activity check loop");
    }
  }
}
