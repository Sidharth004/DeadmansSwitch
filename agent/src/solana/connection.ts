import { Connection, Keypair } from "@solana/web3.js";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { SolanaAgentKit } from "solana-agent-kit";
import { Wallet } from "solana-agent-kit/dist/utils/keypair";
import bs58 from "bs58";
import { PublicKey } from "@solana/web3.js";
import idl from "../idl/dead_mans_switch.json";
import { Config } from "../config";
import { Logger } from "../logger";

export interface SolanaContext {
  connection: Connection;
  provider: AnchorProvider;
  program: Program;
  wallet: Wallet;
  agentKit: SolanaAgentKit;
  agentPublicKey: PublicKey;
}

export function initSolana(config: Config, logger: Logger): SolanaContext {
  const keypair = Keypair.fromSecretKey(bs58.decode(config.agentPrivateKey));
  const wallet = new Wallet(keypair);
  const connection = new Connection(config.solanaRpcUrl, "confirmed");

  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });

  const program = new Program(idl as any, provider);

  const agentKit = new SolanaAgentKit(
    config.agentPrivateKey,
    config.solanaRpcUrl,
    {}
  );

  logger.info(
    { agentWallet: keypair.publicKey.toBase58(), programId: config.programId },
    "Solana context initialized"
  );

  return {
    connection,
    provider,
    program,
    wallet,
    agentKit,
    agentPublicKey: keypair.publicKey,
  };
}

export function getVaultPda(
  ownerPubkey: PublicKey,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), ownerPubkey.toBuffer()],
    programId
  );
}
