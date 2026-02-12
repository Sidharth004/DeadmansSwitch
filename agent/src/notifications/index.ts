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
    const message = getTelegramMessage(newState, templateData);
    await sendTelegramMessage(bot, vaultRecord.telegram_chat_id, message, logger);
  }

  // Email notification
  if (vaultRecord.owner_email) {
    const subject = getEmailSubject(newState);
    const body = getEmailBody(newState, templateData);
    await sendEmail(vaultRecord.owner_email, subject, body, config, logger);
  }
}
