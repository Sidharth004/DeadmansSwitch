import crypto from "crypto";

export const runtime = "nodejs";

function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

export async function GET() {
  const secret = process.env.TG_INTENT_SECRET || null;

  return Response.json(
    {
      ok: true,
      now: new Date().toISOString(),
      vercelEnv: process.env.VERCEL_ENV || null,
      appUrl: process.env.NEXT_PUBLIC_APP_URL || null,
      programId: process.env.NEXT_PUBLIC_PROGRAM_ID || null,
      tgIntentSecretSha256: secret ? sha256Hex(secret) : null,
    },
    { status: 200 }
  );
}

