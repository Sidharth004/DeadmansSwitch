import nodemailer from "nodemailer";
import { Config } from "../config";
import { Logger } from "../logger";

let transporter: nodemailer.Transporter | null = null;

export function initEmailTransport(config: Config, logger: Logger): void {
  if (!config.emailHost || !config.emailUser || !config.emailPass) {
    logger.info("Email not configured — email notifications disabled");
    return;
  }

  transporter = nodemailer.createTransport({
    host: config.emailHost,
    port: config.emailPort,
    secure: config.emailPort === 465,
    auth: {
      user: config.emailUser,
      pass: config.emailPass,
    },
  });

  logger.info({ host: config.emailHost }, "Email transport initialized");
}

export async function sendEmail(
  to: string,
  subject: string,
  body: string,
  config: Config,
  logger: Logger
): Promise<void> {
  if (!transporter) {
    logger.debug("Email transport not configured, skipping");
    return;
  }

  await transporter.sendMail({
    from: config.emailFrom || config.emailUser,
    to,
    subject,
    text: body,
  });
  logger.debug({ to, subject }, "Email sent");
}
