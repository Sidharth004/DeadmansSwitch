"use client";

import { useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@/components/wallet-button";
import { getProgram } from "@/lib/anchor";
import type { TgIntent } from "@/lib/tg-intent";

export default function TgClaimClient({
  intent,
}: {
  intent: Extract<TgIntent, { t: "claim" }>;
}) {
  const { connection } = useConnection();
  const { publicKey, signTransaction, signAllTransactions } = useWallet();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function onClaim() {
    if (!publicKey || !signTransaction) {
      setError("Connect your beneficiary wallet first.");
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);
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
          vault: new PublicKey(intent.vaultPda),
          beneficiary: publicKey,
        })
        .rpc();
      setMessage("Claim confirmed.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Claim failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="shell grid">
      <section className="card grid">
        <h1 style={{ margin: 0 }}>Telegram: Claim</h1>
        <p style={{ color: "var(--muted)", margin: 0 }}>
          Connect your beneficiary wallet and sign a claim transaction.
        </p>
        <WalletMultiButton />
      </section>

      <section className="card grid">
        <p style={{ margin: 0 }}>
          Owner: <code>{intent.ownerAddress}</code>
        </p>
        <p style={{ margin: 0 }}>
          Vault PDA: <code>{intent.vaultPda}</code>
        </p>

        <button className="button" onClick={onClaim} disabled={loading}>
          {loading ? "Claiming..." : "Sign Claim"}
        </button>

        {error && <p style={{ color: "#fca5a5" }}>{error}</p>}
        {message && <p style={{ color: "#86efac" }}>{message}</p>}
      </section>
    </main>
  );
}

