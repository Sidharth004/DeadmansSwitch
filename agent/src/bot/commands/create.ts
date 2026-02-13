import crypto from "crypto";
import { Telegraf } from "telegraf";
import { PublicKey } from "@solana/web3.js";
import { Config } from "../../config";
import { Logger } from "../../logger";
import { encodeIntentPayload, signIntentPayload } from "../intent";

type CreateBeneficiary = {
  address: string;
  share: number;
  email?: string;
};

function randomNonce(): string {
  return crypto.randomBytes(12).toString("hex");
}

export function setupCreateCommand(
  bot: Telegraf,
  config: Config,
  logger: Logger
): void {
  bot.command("create", async (ctx) => {
    // Usage:
    // /create <owner_pubkey> <warning_days> <challenge_days> <deposit_sol> <beneficiary_pubkey:share> [more...]
    const parts = ctx.message.text.trim().split(/\s+/);
    const args = parts.slice(1);

    if (args.length < 5) {
      await ctx.reply(
        [
          "🛠 *Create Vault (non-custodial)*",
          "",
          "Usage:",
          "`/create <owner_pubkey> <warning_days> <challenge_days> <deposit_sol> <beneficiary_pubkey:share[:email]> [beneficiary_pubkey:share[:email] ...]`",
          "",
          "Example:",
          "`/create YourOwnerPubkey 90 15 0.1 BeneficiaryPubkey:100`",
          "",
          "Notes:",
          "- Beneficiaries: 1-5",
          "- Shares must total 100",
          "- Set `warning_days` or `challenge_days` to `0` for a fast demo (immediate advancement on next agent poll)",
          "- You will be sent a link to sign in your wallet",
        ].join("\n"),
        { parse_mode: "Markdown" }
      );
      return;
    }

    const [ownerAddress, warningDaysRaw, challengeDaysRaw, depositSolRaw, ...beneficiaryArgs] =
      args;

    try {
      new PublicKey(ownerAddress);
    } catch {
      await ctx.reply("Invalid owner pubkey.");
      return;
    }

    const warningDays = Number(warningDaysRaw);
    const challengeDays = Number(challengeDaysRaw);
    const depositSol = Number(depositSolRaw);

    // Allow 0 for hackathon demos/testing (immediate escalation on next agent poll).
    if (!Number.isInteger(warningDays) || warningDays < 0) {
      await ctx.reply("warning_days must be an integer >= 0.");
      return;
    }
    if (!Number.isInteger(challengeDays) || challengeDays < 0) {
      await ctx.reply("challenge_days must be an integer >= 0.");
      return;
    }
    if (!Number.isFinite(depositSol) || depositSol < 0) {
      await ctx.reply("deposit_sol must be a non-negative number.");
      return;
    }

    if (beneficiaryArgs.length < 1 || beneficiaryArgs.length > 5) {
      await ctx.reply("Add 1 to 5 beneficiaries.");
      return;
    }

    const beneficiaries: CreateBeneficiary[] = [];
    for (const item of beneficiaryArgs) {
      const [address, shareRaw, emailRaw] = item.split(":");
      const share = Number(shareRaw);
      if (!address || !shareRaw) {
        await ctx.reply(
          "Invalid beneficiary format. Use <beneficiary_pubkey:share>."
        );
        return;
      }
      try {
        new PublicKey(address);
      } catch {
        await ctx.reply(`Invalid beneficiary pubkey: ${address}`);
        return;
      }
      if (!Number.isInteger(share) || share < 1 || share > 100) {
        await ctx.reply(`Invalid share for ${address}. Must be 1-100.`);
        return;
      }
      beneficiaries.push({ address, share, email: emailRaw || undefined });
    }

    const total = beneficiaries.reduce((sum, b) => sum + b.share, 0);
    if (total !== 100) {
      await ctx.reply(`Beneficiary shares must total 100. Current total: ${total}`);
      return;
    }

    const normalized = beneficiaries.map((b) => b.address.trim());
    if (new Set(normalized).size !== normalized.length) {
      await ctx.reply("Beneficiary wallet addresses must be unique.");
      return;
    }

    // Email format validation is enforced on the server as well; keep a lightweight check here.
    for (const b of beneficiaries) {
      if (b.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email)) {
        await ctx.reply(`Invalid beneficiary email: ${b.email}`);
        return;
      }
    }

    const chatId = String(ctx.chat.id);

    const intent = {
      v: 1,
      t: "create",
      ts: Date.now(),
      nonce: randomNonce(),
      chatId,
      ownerAddress,
      warningDays,
      challengeDays,
      depositSol: depositSolRaw,
      beneficiaries,
    };

    const payload = encodeIntentPayload(intent);
    const sig = signIntentPayload(payload, config.tgIntentSecret);

    const url =
      `${config.appUrl.replace(/\/$/, "")}` +
      `/tg/create?payload=${encodeURIComponent(payload)}&sig=${encodeURIComponent(sig)}`;

    logger.info(
      { ownerAddress, chatId, beneficiaries: beneficiaries.length },
      "Generated /create signing link"
    );

    await ctx.reply(
      [
        "🧾 *Vault creation link*",
        "",
        "Open this link, connect the *owner* wallet, and sign to create your vault:",
        url,
        "",
        "After signing, come back and run `/status` to confirm it's linked to this chat.",
      ].join("\n"),
      { parse_mode: "Markdown" }
    );
  });
}
