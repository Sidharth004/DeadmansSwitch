"use client";

import { useMemo, useState } from "react";
import { BN } from "@coral-xyz/anchor";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@/components/wallet-button";
import { getProgram } from "@/lib/anchor";
import { BeneficiaryInput } from "@/lib/types";

const DEFAULT_BENEFICIARIES: BeneficiaryInput[] = [{ address: "", share: 100, email: "" }];

export default function CreateVaultPage() {
  const { connection } = useConnection();
  const { publicKey, signTransaction, signAllTransactions } = useWallet();

  const [warningDays, setWarningDays] = useState(90);
  const [challengeDays, setChallengeDays] = useState(15);
  const [depositAmount, setDepositAmount] = useState("0.1");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [beneficiaries, setBeneficiaries] = useState<BeneficiaryInput[]>(DEFAULT_BENEFICIARIES);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ id: string; owner: string; vaultPda: string } | null>(null);

  const totalShare = useMemo(
    () => beneficiaries.reduce((sum, item) => sum + (Number.isFinite(item.share) ? item.share : 0), 0),
    [beneficiaries]
  );

  async function handleCreateVault() {
    if (!publicKey || !signTransaction) {
      setError("Connect your wallet first.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (beneficiaries.length === 0 || beneficiaries.length > 5) {
        throw new Error("Add 1 to 5 beneficiaries.");
      }
      if (totalShare !== 100) {
        throw new Error("Beneficiary shares must total exactly 100.");
      }

      const parsedBeneficiaries = beneficiaries.map((b) => ({
        address: new PublicKey(b.address.trim()),
        share: b.share,
        hasClaimed: false,
      }));

      const walletForAnchor = {
        publicKey,
        signTransaction,
        signAllTransactions: signAllTransactions ?? (async (txs: any[]) => Promise.all(txs.map(signTransaction))),
      };

      const program = getProgram(connection, walletForAnchor);
      const [vaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), publicKey.toBuffer()],
        program.programId
      );

      await program.methods
        .initializeVault(new BN(warningDays * 24 * 60 * 60), new BN(challengeDays * 24 * 60 * 60), parsedBeneficiaries)
        .accounts({
          vault: vaultPda,
          owner: publicKey,
        })
        .rpc();

      const depositSol = Number(depositAmount);
      if (depositSol > 0) {
        await program.methods
          .depositSol(new BN(Math.floor(depositSol * LAMPORTS_PER_SOL)))
          .accounts({
            vault: vaultPda,
            owner: publicKey,
          })
          .rpc();
      }

      const response = await fetch("/api/vaults", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerAddress: publicKey.toBase58(),
          vaultPda: vaultPda.toBase58(),
          warningPeriodDays: warningDays,
          challengePeriodDays: challengeDays,
          ownerEmail: ownerEmail || null,
          beneficiaries,
        }),
      });

      if (!response.ok) {
        throw new Error("Vault created on-chain, but DB save failed.");
      }

      const data = await response.json();
      setResult({ id: data.id, owner: publicKey.toBase58(), vaultPda: vaultPda.toBase58() });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="shell grid">
      <section className="card grid">
        <h1 style={{ margin: 0 }}>Create Vault</h1>
        <p style={{ color: "var(--muted)", marginTop: 0 }}>
          Configure timers, beneficiaries, then initialize and optionally deposit SOL.
        </p>
        <WalletMultiButton />
      </section>

      <section className="card grid">
        <label>
          Warning Period (days)
          <input className="input" type="number" min={1} value={warningDays} onChange={(e) => setWarningDays(Number(e.target.value))} />
        </label>

        <label>
          Challenge Period (days)
          <input className="input" type="number" min={1} value={challengeDays} onChange={(e) => setChallengeDays(Number(e.target.value))} />
        </label>

        <label>
          Owner Email (optional)
          <input className="input" type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} />
        </label>

        <label>
          Initial Deposit (SOL)
          <input className="input" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} />
        </label>

        <div className="grid">
          <strong>Beneficiaries</strong>
          {beneficiaries.map((beneficiary, i) => (
            <div key={i} className="grid" style={{ gridTemplateColumns: "1fr 120px 1fr", alignItems: "end" }}>
              <label>
                Wallet Address
                <input
                  className="input"
                  value={beneficiary.address}
                  onChange={(e) => {
                    const next = [...beneficiaries];
                    next[i] = { ...next[i], address: e.target.value };
                    setBeneficiaries(next);
                  }}
                />
              </label>
              <label>
                Share %
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={100}
                  value={beneficiary.share}
                  onChange={(e) => {
                    const next = [...beneficiaries];
                    next[i] = { ...next[i], share: Number(e.target.value) };
                    setBeneficiaries(next);
                  }}
                />
              </label>
              <label>
                Email (optional)
                <input
                  className="input"
                  type="email"
                  value={beneficiary.email || ""}
                  onChange={(e) => {
                    const next = [...beneficiaries];
                    next[i] = { ...next[i], email: e.target.value };
                    setBeneficiaries(next);
                  }}
                />
              </label>
            </div>
          ))}

          <div style={{ display: "flex", gap: 12 }}>
            <button
              className="button"
              type="button"
              onClick={() => setBeneficiaries([...beneficiaries, { address: "", share: 0, email: "" }])}
              disabled={beneficiaries.length >= 5}
            >
              Add Beneficiary
            </button>
            <button
              className="button"
              type="button"
              onClick={() => beneficiaries.length > 1 && setBeneficiaries(beneficiaries.slice(0, -1))}
              disabled={beneficiaries.length <= 1}
            >
              Remove Last
            </button>
          </div>
          <small style={{ color: totalShare === 100 ? "#86efac" : "#fca5a5" }}>Total share: {totalShare}% (must equal 100)</small>
        </div>

        <button className="button" onClick={handleCreateVault} disabled={loading || !publicKey}>
          {loading ? "Creating vault..." : "Create Vault"}
        </button>

        {error && <p style={{ color: "#fca5a5" }}>{error}</p>}

        {result && (
          <div className="card" style={{ boxShadow: "var(--glow)" }}>
            <h3 style={{ marginTop: 0 }}>Vault Created</h3>
            <p style={{ color: "var(--muted)" }}>Vault ID: {result.id}</p>
            <p style={{ color: "var(--muted)" }}>PDA: {result.vaultPda}</p>
            <a
              className="button"
              href={`https://t.me/${process.env.NEXT_PUBLIC_BOT_USERNAME}?start=${result.owner}`}
              target="_blank"
              rel="noreferrer"
            >
              Link Telegram Bot
            </a>
          </div>
        )}
      </section>
    </main>
  );
}
