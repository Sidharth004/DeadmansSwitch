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
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!params.id) return;
    fetch(`/api/vaults/${params.id}`)
      .then((res) => res.json())
      .then((data) => setVault(data))
      .catch(() => setMessage("Failed to load vault."));
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
      setMessage("Claim transaction submitted.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Claim failed");
    }
  }

  if (!vault) {
    return (
      <main className="shell card">
        <p>Loading vault...</p>
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
            <button className="button" disabled={!canClaim} onClick={onClaim}>
              Claim Assets
            </button>
          </>
        ) : (
          <p style={{ color: "#fca5a5" }}>Connected wallet is not a beneficiary for this vault.</p>
        )}
        {vault.state !== "claimable" && (
          <small style={{ color: "var(--muted)" }}>Assets become claimable only in CLAIMABLE state.</small>
        )}
        {message && <p style={{ color: "#86efac" }}>{message}</p>}
      </section>
    </main>
  );
}
