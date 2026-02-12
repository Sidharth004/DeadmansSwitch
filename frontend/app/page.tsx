import Link from "next/link";
import { WalletMultiButton } from "@/components/wallet-button";

export default function HomePage() {
  return (
    <main className="shell grid">
      <section className="card grid" style={{ gap: 8 }}>
        <p style={{ letterSpacing: 2, color: "var(--accent)", fontFamily: "'IBM Plex Mono', monospace" }}>
          DEAD MAN'S SWITCH
        </p>
        <h1 style={{ fontSize: "clamp(2rem, 5vw, 3.4rem)", margin: 0 }}>Crypto inheritance, no custodian.</h1>
        <p style={{ color: "var(--muted)", marginTop: 0 }}>
          Create a Solana vault, configure beneficiaries, and rely on a monitoring agent to move states safely.
        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link className="button" style={{ maxWidth: 220, textAlign: "center" }} href="/create">
            Create Vault
          </Link>
          <WalletMultiButton />
        </div>
      </section>

      <section className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <div className="card">
          <h3>1. Configure</h3>
          <p style={{ color: "var(--muted)" }}>Set warning/challenge periods and beneficiary shares.</p>
        </div>
        <div className="card">
          <h3>2. Monitor</h3>
          <p style={{ color: "var(--muted)" }}>Agent and Telegram bot track status and notify on transitions.</p>
        </div>
        <div className="card">
          <h3>3. Claim</h3>
          <p style={{ color: "var(--muted)" }}>When claimable, beneficiaries claim directly on-chain.</p>
        </div>
      </section>
    </main>
  );
}
