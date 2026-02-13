import { verifyTgIntent } from "@/lib/tg-intent";
import TgCheckinClient from "@/components/tg/tg-checkin-client";

export const runtime = "nodejs";

export default function TgCheckinPage({
  searchParams,
}: {
  searchParams: { payload?: string; sig?: string };
}) {
  const payload = searchParams.payload;
  const sig = searchParams.sig;

  if (!payload || !sig) {
    return (
      <main className="shell card">
        <p style={{ color: "#fca5a5" }}>Missing payload or signature.</p>
      </main>
    );
  }

  try {
    const intent = verifyTgIntent(payload, sig);
    if (intent.t !== "checkin") {
      throw new Error("Wrong intent type");
    }
    return <TgCheckinClient intent={intent} />;
  } catch (err) {
    return (
      <main className="shell card">
        <p style={{ color: "#fca5a5" }}>
          {err instanceof Error ? err.message : "Invalid request"}
        </p>
      </main>
    );
  }
}

