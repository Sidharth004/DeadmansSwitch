"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@/components/wallet-button";
import { VaultRecord } from "@/lib/types";

export default function VaultListPage() {
  const { publicKey } = useWallet();
  const [vaults, setVaults] = useState<VaultRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadVaults(owner: string) {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/vaults?owner=${owner}`);
      if (!response.ok) {
        const failure = await response.json().catch(() => ({ error: "Failed to fetch vaults." }));
        throw new Error(failure.error || "Failed to fetch vaults.");
      }
      const data = await response.json();
      setVaults(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch vaults.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!publicKey) {
      setVaults([]);
      return;
    }
    loadVaults(publicKey.toBase58());
  }, [publicKey?.toBase58()]);

  return (
    <main className="shell grid">
      <section className="card grid">
        <h1 style={{ margin: 0 }}>My Vaults</h1>
        <p style={{ color: "var(--muted)", margin: 0 }}>
          Connect your owner wallet to list vaults created in this app.
        </p>
        <WalletMultiButton />
      </section>

      <section className="card grid">
        {!publicKey && <p style={{ color: "var(--muted)" }}>Wallet not connected.</p>}
        {loading && <p>Loading vaults...</p>}
        {error && <p style={{ color: "#fca5a5" }}>{error}</p>}

        {publicKey && !loading && vaults.length === 0 && (
          <div className="grid">
            <p style={{ color: "var(--muted)", margin: 0 }}>No vault found for this wallet.</p>
            <Link className="button" href="/create">
              Create Vault
            </Link>
          </div>
        )}

        {vaults.map((vault) => (
          <div key={vault.id} className="card grid" style={{ margin: 0 }}>
            <p style={{ margin: 0 }}>
              <strong>State:</strong> {vault.state.toUpperCase()}
            </p>
            <p style={{ color: "var(--muted)", margin: 0 }}>Vault ID: {vault.id}</p>
            <p style={{ color: "var(--muted)", margin: 0 }}>PDA: {vault.vault_pda}</p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Link className="button" style={{ maxWidth: 220, textAlign: "center" }} href={`/vault/${vault.id}`}>
                Open Dashboard
              </Link>
              <Link className="button" style={{ maxWidth: 220, textAlign: "center" }} href={`/claim/${vault.id}`}>
                Open Claim Page
              </Link>
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
