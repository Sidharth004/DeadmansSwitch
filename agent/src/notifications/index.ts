import { Telegraf } from "telegraf";
import { VaultStateLabel } from "../types";
import { BeneficiaryRecord, VaultRecord } from "../database/types";
import { Config } from "../config";
import { Logger } from "../logger";
import { sendTelegramMessage } from "./telegram";
import { sendEmail } from "./email";
import {
  getTelegramMessage,
  getEmailSubject,
  getEmailBody,
} from "./templates";
import { withRetry } from "../utils/retry";
import { encodeIntentPayload, signIntentPayload } from "../bot/intent";

export async function notifyStateTransition(
  newState: VaultStateLabel,
  vaultRecord: VaultRecord,
  beneficiaries: BeneficiaryRecord[] | null,
  bot: Telegraf,
  config: Config,
  logger: Logger
): Promise<void> {
  const templateData = {
    ownerAddress: vaultRecord.owner_address,
    vaultPda: vaultRecord.vault_pda,
    appUrl: config.appUrl,
  };

  // Telegram notification
  if (vaultRecord.telegram_chat_id) {
    try {
      const message = getTelegramMessage(newState, templateData);
      await withRetry(
        () => sendTelegramMessage(bot, vaultRecord.telegram_chat_id!, message, logger),
        {
          attempts: config.notificationRetryAttempts,
          baseDelayMs: config.notificationRetryBaseDelayMs,
          operationName: "telegram_notification",
          logger,
        }
      );
    } catch (err) {
      logger.error(
        {
          err,
          owner: vaultRecord.owner_address,
          chatId: vaultRecord.telegram_chat_id,
          state: newState,
        },
        "Failed to send Telegram notification after retries"
      );
    }
  }

  // Email notification
  if (vaultRecord.owner_email) {
    try {
      const subject = getEmailSubject(newState);
      const body = getEmailBody(newState, templateData);
      await withRetry(
        () => sendEmail(vaultRecord.owner_email!, subject, body, config, logger),
        {
          attempts: config.notificationRetryAttempts,
          baseDelayMs: config.notificationRetryBaseDelayMs,
          operationName: "email_notification",
          logger,
        }
      );
    } catch (err) {
      logger.error(
        {
          err,
          owner: vaultRecord.owner_address,
          email: vaultRecord.owner_email,
          state: newState,
        },
        "Failed to send email notification after retries"
      );
    }
  }

  if (newState === "claimable" && beneficiaries && beneficiaries.length > 0) {
    const claimLinks = new Map<string, string>();
    for (const b of beneficiaries) {
      const intent = {
        v: 1,
        t: "claim",
        ts: Date.now(),
        nonce: "auto",
        ownerAddress: vaultRecord.owner_address,
        vaultPda: vaultRecord.vault_pda,
      };
      const payload = encodeIntentPayload(intent);
      const sig = signIntentPayload(payload, config.tgIntentSecret);
      const url =
        `${config.appUrl.replace(/\/$/, "")}` +
        `/tg/claim?payload=${encodeURIComponent(payload)}&sig=${encodeURIComponent(sig)}`;
      claimLinks.set(b.address, url);
    }

    for (const b of beneficiaries) {
      const claimUrl = claimLinks.get(b.address)!;

      if (b.telegram_chat_id) {
        try {
          const message = [
            "🏦 *Vault is claimable*",
            "",
            `Owner: \`${vaultRecord.owner_address}\``,
            `Vault: \`${vaultRecord.vault_pda.slice(0, 8)}...\``,
            `Your share: ${b.share}%`,
            "",
            `🔗 [Claim now](${claimUrl})`,
          ].join("\n");
          await withRetry(
            () => sendTelegramMessage(bot, b.telegram_chat_id!, message, logger),
            {
              attempts: config.notificationRetryAttempts,
              baseDelayMs: config.notificationRetryBaseDelayMs,
              operationName: "beneficiary_telegram_notification",
              logger,
            }
          );
        } catch (err) {
          logger.error(
            { err, beneficiary: b.address, chatId: b.telegram_chat_id },
            "Failed to send beneficiary Telegram notification after retries"
          );
        }
      }

      if (b.email) {
        try {
          const subject = "Dead Man's Switch — You can now claim";
          const body = [
            `A Dead Man's Switch vault is now CLAIMABLE.`,
            ``,
            `Owner: ${vaultRecord.owner_address}`,
            `Vault: ${vaultRecord.vault_pda}`,
            `Your share: ${b.share}%`,
            ``,
            `Claim link: ${claimUrl}`,
          ].join("\n");
          await withRetry(
            () => sendEmail(b.email!, subject, body, config, logger),
            {
              attempts: config.notificationRetryAttempts,
              baseDelayMs: config.notificationRetryBaseDelayMs,
              operationName: "beneficiary_email_notification",
              logger,
            }
          );
        } catch (err) {
          logger.error(
            { err, beneficiary: b.address, email: b.email },
            "Failed to send beneficiary email notification after retries"
          );
        }
      }
    }
  }
}
