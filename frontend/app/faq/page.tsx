import Link from "next/link";

const FAQS = [
  {
    q: "Is this custodial?",
    a: "No. Assets remain locked in your on-chain vault PDA and can only move through program instructions.",
  },
  {
    q: "What resets the timer?",
    a: "Any owner check-in resets inactivity timers back to ACTIVE. The monitoring agent can automate this when wallet activity is detected.",
  },
  {
    q: "When can beneficiaries claim?",
    a: "Only after the vault reaches CLAIMABLE state and only for beneficiaries configured in the vault.",
  },
  {
    q: "Can I add multiple beneficiaries?",
    a: "Yes. You can configure 1-5 beneficiaries and shares must total exactly 100%.",
  },
  {
    q: "How do Telegram notifications work?",
    a: "After vault creation, link your wallet to the bot using /start <owner-pubkey> so alerts can be delivered to your chat.",
  },
];

export default function FaqPage() {
  return (
    <main className="shell grid">
      <section className="card grid">
        <h1 style={{ margin: 0 }}>FAQ</h1>
        <p style={{ color: "var(--muted)", margin: 0 }}>
          Quick answers for setup, monitoring, and claim flow.
        </p>
      </section>

      <section className="card grid">
        {FAQS.map((faq) => (
          <div key={faq.q} style={{ borderTop: "1px solid var(--line)", paddingTop: 12 }}>
            <h3 style={{ margin: 0 }}>{faq.q}</h3>
            <p style={{ color: "var(--muted)", marginBottom: 0 }}>{faq.a}</p>
          </div>
        ))}
      </section>

      <section className="card grid">
        <h3 style={{ margin: 0 }}>Need Next Steps?</h3>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link className="button" href="/create" style={{ maxWidth: 220, textAlign: "center" }}>
            Create Vault
          </Link>
          <Link className="button" href="/vault" style={{ maxWidth: 220, textAlign: "center" }}>
            Open Dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}
