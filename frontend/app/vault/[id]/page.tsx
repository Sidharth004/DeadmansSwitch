"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { PublicKey } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@/components/wallet-button";
import { getProgram } from "@/lib/anchor";
import { VaultWithBeneficiaries } from "@/lib/types";

export default function VaultDashboardPage() {
  const params = useParams<{ id: string }>();
  const { connection } = useConnection();
  const { publicKey, signTransaction, signAllTransactions } = useWallet();
  const [vault, setVault] = useState<VaultWithBeneficiaries | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const canCheckIn = useMemo(
    () => !!vault && !!publicKey && publicKey.toBase58() === vault.owner_address,
    [vault, publicKey]
  );

  useEffect(() => {
    if (!params.id) return;
    fetch(`/api/vaults/${params.id}`)
      .then((res) => res.json())
      .then((data) => setVault(data))
      .catch(() => setMessage("Failed to load vault."));
  }, [params.id]);

  async function onCheckIn() {
    if (!vault || !publicKey || !signTransaction) {
      setMessage("Connect the owner wallet to check in.");
      return;
    }

    try {
      const walletForAnchor = {
        publicKey,
        signTransaction,
        signAllTransactions: signAllTransactions ?? (async (txs: any[]) => Promise.all(txs.map(signTransaction))),
      };
      const program = getProgram(connection, walletForAnchor);
      await program.methods
        .checkIn()
        .accounts({
          vault: new PublicKey(vault.vault_pda),
          owner: publicKey,
        })
        .rpc();
      setMessage("Check-in successful. Timer reset.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Check-in failed");
    }
  }

  if (!vault) {
    return (
      <main className="shell card">
        <p>Loading vault...</p>
      </main>
    );
  }

  return (
    <main className="shell grid">
      <section className="card grid">
        <h1 style={{ margin: 0 }}>Vault Dashboard</h1>
        <WalletMultiButton />
        <p style={{ color: "var(--muted)", margin: 0 }}>Vault ID: {vault.id}</p>
        <p style={{ color: "var(--muted)", margin: 0 }}>Owner: {vault.owner_address}</p>
        <p style={{ margin: 0 }}>
          State: <strong>{vault.state.toUpperCase()}</strong>
        </p>
        <p style={{ color: "var(--muted)", margin: 0 }}>
          Warning: {vault.warning_period_days ?? "n/a"} days | Challenge: {vault.challenge_period_days ?? "n/a"} days
        </p>
        <button className="button" disabled={!canCheckIn} onClick={onCheckIn}>
          Check In
        </button>
        {!canCheckIn && (
          <small style={{ color: "var(--muted)" }}>Only the owner wallet can check in.</small>
        )}
        {message && <p style={{ color: "#86efac" }}>{message}</p>}
      </section>

      <section className="card grid">
        <h3 style={{ margin: 0 }}>Beneficiaries</h3>
        {vault.beneficiaries.map((beneficiary) => (
          <div key={beneficiary.id} style={{ borderTop: "1px solid var(--line)", paddingTop: 10 }}>
            <p style={{ margin: 0 }}>{beneficiary.address}</p>
            <p style={{ color: "var(--muted)", margin: 0 }}>
              Share: {beneficiary.share}% | Claimed: {beneficiary.has_claimed ? "yes" : "no"}
            </p>
          </div>
        ))}
      </section>
    </main>
  );
}
