import { Telegraf } from "telegraf";
import { VaultStateLabel } from "../types";
import { VaultRecord } from "../database/types";
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

export async function notifyStateTransition(
  newState: VaultStateLabel,
  vaultRecord: VaultRecord,
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
}
