import fs from "fs";
import os from "os";
import path from "path";
import { AnchorProvider, BN, Program } from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  VersionedTransaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { Telegraf } from "telegraf";
import idl from "../idl/dead_mans_switch.json";
import { loadConfig } from "../config";
import { createLogger } from "../logger";
import { createVaultStore } from "../database";
import { initSolana } from "../solana/connection";
import { VaultMonitor } from "../monitor";
import { fetchVaultState } from "../solana/vault-reader";

type KeypairWallet = {
  publicKey: PublicKey;
  signTransaction(tx: Transaction): Promise<Transaction>;
  signAllTransactions(txs: Transaction[]): Promise<Transaction[]>;
  signVersionedTransaction?(
    tx: VersionedTransaction
  ): Promise<VersionedTransaction>;
  signAllVersionedTransactions?(
    txs: VersionedTransaction[]
  ): Promise<VersionedTransaction[]>;
};

function walletFromKeypair(keypair: Keypair): KeypairWallet {
  return {
    publicKey: keypair.publicKey,
    signTransaction: async (tx: Transaction) => {
      tx.sign(keypair);
      return tx;
    },
    signAllTransactions: async (txs: Transaction[]) => {
      txs.forEach((tx) => tx.sign(keypair));
      return txs;
    },
  };
}

async function airdrop(
  connection: Connection,
  pubkey: PublicKey,
  sol: number
): Promise<void> {
  const signature = await connection.requestAirdrop(
    pubkey,
    Math.floor(sol * LAMPORTS_PER_SOL)
  );
  await connection.confirmTransaction(signature, "confirmed");
}

async function transferFunding(
  connection: Connection,
  payer: Keypair,
  recipient: PublicKey,
  sol: number
): Promise<void> {
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: recipient,
      lamports: Math.floor(sol * LAMPORTS_PER_SOL),
    })
  );
  await sendAndConfirmTransaction(connection, tx, [payer], {
    commitment: "confirmed",
  });
}

function loadDefaultPayerKeypair(): Keypair {
  const keypairPath = path.join(os.homedir(), ".config", "solana", "id.json");
  const secretKey = JSON.parse(fs.readFileSync(keypairPath, "utf8")) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(secretKey));
}

async function waitForClaimable(
  program: Program,
  owner: PublicKey,
  timeoutMs: number,
  pollMs: number
): Promise<void> {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const vault = await fetchVaultState(program, owner);
    if (vault?.state === "claimable" || vault?.state === "claimed") {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }

  throw new Error("Timed out waiting for vault to become claimable");
}

async function main() {
  const config = loadConfig();
  const logger = createLogger(config.logLevel);
  const connection = new Connection(config.solanaRpcUrl, "confirmed");

  const skipClaim =
    process.env.E2E_SKIP_CLAIM === "1" ||
    process.env.E2E_SKIP_CLAIM === "true" ||
    process.env.E2E_SKIP_CLAIM === "yes";

  const owner = Keypair.generate();
  const beneficiary = Keypair.generate();
  const fallbackPayer = loadDefaultPayerKeypair();

  logger.info(
    {
      owner: owner.publicKey.toBase58(),
      beneficiary: beneficiary.publicKey.toBase58(),
    },
    "Generated test keypairs"
  );

  try {
    await airdrop(connection, owner.publicKey, 1.0);
    await airdrop(connection, beneficiary.publicKey, 0.2);
    logger.info("Funded test wallets via airdrop");
  } catch (err) {
    logger.warn(
      { err, payer: fallbackPayer.publicKey.toBase58() },
      "Airdrop failed, falling back to local payer transfer"
    );
    await transferFunding(connection, fallbackPayer, owner.publicKey, 0.7);
    await transferFunding(connection, fallbackPayer, beneficiary.publicKey, 0.2);
    logger.info("Funded test wallets via local payer transfer");
  }

  const ownerProvider = new AnchorProvider(
    connection,
    walletFromKeypair(owner) as any,
    {
      commitment: "confirmed",
    }
  );
  const ownerProgram = new Program(idl as any, ownerProvider);

  const [vaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), owner.publicKey.toBuffer()],
    ownerProgram.programId
  );

  const warningSeconds = 20;
  const challengeSeconds = 20;

  await ownerProgram.methods
    .initializeVault(
      new BN(warningSeconds),
      new BN(challengeSeconds),
      [{ address: beneficiary.publicKey, share: 100, hasClaimed: false }]
    )
    .accounts({
      vault: vaultPda,
      owner: owner.publicKey,
    })
    .signers([owner])
    .rpc();

  await ownerProgram.methods
    .depositSol(new BN(0.05 * LAMPORTS_PER_SOL))
    .accounts({
      vault: vaultPda,
      owner: owner.publicKey,
    })
    .signers([owner])
    .rpc();

  logger.info({ vaultPda: vaultPda.toBase58() }, "Vault initialized and funded");

  const store = createVaultStore(config, logger);
  const vaultRecord = await store.upsertVault({
    owner_address: owner.publicKey.toBase58(),
    vault_pda: vaultPda.toBase58(),
    state: "active",
    warning_period_days: null,
    challenge_period_days: null,
    telegram_chat_id: null,
    owner_email: null,
    last_activity_reminder_at: null,
  });

  // Ensure beneficiaries exist in the DB so claimable notifications can fan out.
  await store.upsertBeneficiaries([
    {
      vault_id: vaultRecord.id,
      address: beneficiary.publicKey.toBase58(),
      share: 100,
      email: process.env.E2E_BENEFICIARY_EMAIL || null,
      telegram_chat_id: null,
      has_claimed: false,
    },
  ]);

  logger.info("Vault + beneficiaries inserted into tracking store");

  const solana = initSolana(config, logger);
  const bot = new Telegraf(config.telegramBotToken);
  const monitorConfig = {
    ...config,
    pollIntervalMs: 3000,
    activityCheckIntervalMs: 7000,
  };
  const monitor = new VaultMonitor(solana, store, bot, monitorConfig, logger);
  monitor.start();

  try {
    await waitForClaimable(solana.program, owner.publicKey, 120_000, 3000);
    logger.info("Vault reached claimable state");
  } finally {
    monitor.stop();
  }

  if (skipClaim) {
    logger.info(
      {
        owner: owner.publicKey.toBase58(),
        beneficiary: beneficiary.publicKey.toBase58(),
        vault: vaultPda.toBase58(),
      },
      "E2E_SKIP_CLAIM enabled; leaving vault claimable for manual beneficiary claim"
    );
    return;
  }

  const beneficiaryProvider = new AnchorProvider(
    connection,
    walletFromKeypair(beneficiary) as any,
    {
      commitment: "confirmed",
    }
  );
  const beneficiaryProgram = new Program(idl as any, beneficiaryProvider);

  const balanceBefore = await connection.getBalance(beneficiary.publicKey);
  await beneficiaryProgram.methods
    .claim()
    .accounts({
      vault: vaultPda,
      beneficiary: beneficiary.publicKey,
    })
    .signers([beneficiary])
    .rpc();
  const balanceAfter = await connection.getBalance(beneficiary.publicKey);

  const finalVault = await fetchVaultState(solana.program, owner.publicKey);
  logger.info(
    {
      beneficiaryBalanceBefore: balanceBefore / LAMPORTS_PER_SOL,
      beneficiaryBalanceAfter: balanceAfter / LAMPORTS_PER_SOL,
      finalState: finalVault?.state,
      vault: vaultPda.toBase58(),
    },
    "E2E flow completed successfully"
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
