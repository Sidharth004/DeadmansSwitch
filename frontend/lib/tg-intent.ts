import crypto from "crypto";

export type TgIntent =
  | {
      v: 1;
      t: "create";
      ts: number;
      nonce: string;
      chatId: string;
      ownerAddress: string;
      warningDays: number;
      challengeDays: number;
      depositSol: string;
      beneficiaries: { address: string; share: number; email?: string }[];
    }
  | {
      v: 1;
      t: "checkin";
      ts: number;
      nonce: string;
      chatId: string;
      ownerAddress: string;
      vaultPda: string;
    }
  | {
      v: 1;
      t: "claim";
      ts: number;
      nonce: string;
      ownerAddress: string;
      vaultPda: string;
    };

function base64UrlDecode(input: string): Buffer {
  const padded = input.replaceAll("-", "+").replaceAll("_", "/") + "===".slice((input.length + 3) % 4);
  return Buffer.from(padded, "base64");
}

function base64UrlEncode(buf: Buffer): string {
  return buf.toString("base64").replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export function verifyTgIntent(payloadB64Url: string, sigB64Url: string): TgIntent {
  const secret = process.env.TG_INTENT_SECRET;
  if (!secret) {
    throw new Error("TG_INTENT_SECRET is not configured on the server");
  }

  const expected = crypto.createHmac("sha256", secret).update(payloadB64Url, "utf8").digest();
  const expectedB64Url = base64UrlEncode(expected);

  const a = Buffer.from(expectedB64Url, "utf8");
  const b = Buffer.from(sigB64Url, "utf8");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new Error("Invalid intent signature");
  }

  const json = base64UrlDecode(payloadB64Url).toString("utf8");
  const parsed = JSON.parse(json) as TgIntent;

  if (!parsed || (parsed as any).v !== 1 || typeof (parsed as any).t !== "string") {
    throw new Error("Invalid intent payload");
  }

  return parsed;
}
