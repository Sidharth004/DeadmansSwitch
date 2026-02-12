"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { PublicKey } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@/components/wallet-button";
import { getProgram } from "@/lib/anchor";
import { VaultWithBeneficiaries } from "@/lib/types";

export default function ClaimPage() {
  const params = useParams<{ id: string }>();
  const { connection } = useConnection();
  const { publicKey, signTransaction, signAllTransactions } = useWallet();
  const [vault, setVault] = useState<VaultWithBeneficiaries | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadVault() {
    if (!params.id) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/vaults/${params.id}`);
      if (!response.ok) {
        const failure = await response.json().catch(() => ({ error: "Failed to load vault." }));
        throw new Error(failure.error || "Failed to load vault.");
      }
      const data = await response.json();
      setVault(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load vault.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadVault();
  }, [params.id]);

  const beneficiary = useMemo(() => {
    if (!vault || !publicKey) return null;
    return vault.beneficiaries.find((b) => b.address === publicKey.toBase58()) ?? null;
  }, [vault, publicKey]);

  async function onClaim() {
    if (!vault || !publicKey || !signTransaction) {
      setMessage("Connect beneficiary wallet first.");
      return;
    }

    setClaiming(true);
    setMessage(null);
    setError(null);
    try {
      const walletForAnchor = {
        publicKey,
        signTransaction,
        signAllTransactions: signAllTransactions ?? (async (txs: any[]) => Promise.all(txs.map(signTransaction))),
      };
      const program = getProgram(connection, walletForAnchor);
      await program.methods
        .claim()
        .accounts({
          vault: new PublicKey(vault.vault_pda),
          beneficiary: publicKey,
        })
        .rpc();
      await loadVault();
      setMessage("Claim transaction confirmed.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Claim failed");
    } finally {
      setClaiming(false);
    }
  }

  if (loading) {
    return (
      <main className="shell card">
        <p>Loading vault...</p>
      </main>
    );
  }

  if (!vault) {
    return (
      <main className="shell card">
        <p style={{ color: "#fca5a5" }}>{error || "Vault not found."}</p>
      </main>
    );
  }

  const canClaim = vault.state === "claimable" && !!beneficiary && !beneficiary.has_claimed;

  return (
    <main className="shell grid">
      <section className="card grid">
        <h1 style={{ margin: 0 }}>Claim Inheritance</h1>
        <WalletMultiButton />
        <p style={{ margin: 0 }}>
          Vault state: <strong>{vault.state.toUpperCase()}</strong>
        </p>
        {beneficiary ? (
          <>
            <p style={{ margin: 0 }}>Your share: {beneficiary.share}%</p>
            <button className="button" disabled={!canClaim || claiming} onClick={onClaim}>
              {claiming ? "Claiming..." : "Claim Assets"}
            </button>
          </>
        ) : (
          <p style={{ color: "#fca5a5" }}>Connected wallet is not a beneficiary for this vault.</p>
        )}
        {vault.state !== "claimable" && (
          <small style={{ color: "var(--muted)" }}>Assets become claimable only in CLAIMABLE state.</small>
        )}
        {error && <p style={{ color: "#fca5a5" }}>{error}</p>}
        {message && <p style={{ color: "#86efac" }}>{message}</p>}
        <button className="button" type="button" onClick={loadVault} disabled={loading || claiming}>
          Refresh Vault
        </button>
      </section>
    </main>
  );
}
