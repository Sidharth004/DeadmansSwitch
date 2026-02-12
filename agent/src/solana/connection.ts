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
  const configuredProgramId = new PublicKey(config.programId);
  const idlProgramId = new PublicKey((idl as any).address);

  if (!configuredProgramId.equals(idlProgramId)) {
    logger.warn(
      {
        configuredProgramId: configuredProgramId.toBase58(),
        idlProgramId: idlProgramId.toBase58(),
      },
      "PROGRAM_ID differs from IDL address; using configured program ID"
    );
  }

  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });

  const programIdl = { ...(idl as any), address: configuredProgramId.toBase58() };
  const program = new Program(programIdl, provider);

  const agentKit = new SolanaAgentKit(
    config.agentPrivateKey,
    config.solanaRpcUrl,
    {}
  );

  logger.info(
    {
      agentWallet: keypair.publicKey.toBase58(),
      programId: program.programId.toBase58(),
    },
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
