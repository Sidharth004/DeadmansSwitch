import { AnchorProvider, BN, Program } from "@coral-xyz/anchor";
import { Connection, PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import idl from "@/idl/dead_mans_switch.json";

export type WalletAdapterForAnchor = {
  publicKey: PublicKey;
  signTransaction(tx: Transaction): Promise<Transaction>;
  signAllTransactions?(txs: Transaction[]): Promise<Transaction[]>;
  signVersionedTransaction?(tx: VersionedTransaction): Promise<VersionedTransaction>;
  signAllVersionedTransactions?(txs: VersionedTransaction[]): Promise<VersionedTransaction[]>;
};

export function getProgram(connection: Connection, wallet: WalletAdapterForAnchor) {
  const provider = new AnchorProvider(connection, wallet as any, {
    commitment: "confirmed",
  });

  return new Program(idl as any, provider);
}

export function toLamports(sol: number): BN {
  return new BN(Math.floor(sol * 1_000_000_000));
}

export function getProgramId(): PublicKey {
  const envProgramId = process.env.NEXT_PUBLIC_PROGRAM_ID;
  return new PublicKey(envProgramId ?? (idl as any).address);
}
