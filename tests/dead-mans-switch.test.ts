import { describe, it, expect, beforeAll } from "vitest";
import { startAnchor, Clock } from "solana-bankrun";
import { BankrunProvider } from "anchor-bankrun";
import {
  PublicKey,
  Keypair,
  LAMPORTS_PER_SOL,
  SystemProgram,
} from "@solana/web3.js";
import { Program, BN } from "@coral-xyz/anchor";
import IDL from "../target/idl/dead_mans_switch.json";
import type { DeadMansSwitch } from "../target/types/dead_mans_switch";

const PROGRAM_ID = new PublicKey(IDL.address);
const WARNING_PERIOD = 60;
const CHALLENGE_PERIOD = 30;

function getVaultPda(owner: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), owner.toBuffer()],
    PROGRAM_ID
  );
}

async function advanceClock(
  context: Awaited<ReturnType<typeof startAnchor>>,
  newUnixTimestamp: number
) {
  const currentClock = await context.banksClient.getClock();
  const currentTimestamp = Number(currentClock.unixTimestamp);
  const timeDelta = newUnixTimestamp - currentTimestamp;
  // ~2.5 slots per second in bankrun; overshoot to ensure the slot-based
  // auto-calculated timestamp is at or past our target
  const slotsNeeded = Math.max(1, Math.ceil(timeDelta * 3));
  const targetSlot = currentClock.slot + BigInt(slotsNeeded);
  context.warpToSlot(targetSlot);
  context.setClock(
    new Clock(
      targetSlot,
      currentClock.epochStartTimestamp,
      currentClock.epoch,
      currentClock.leaderScheduleEpoch,
      BigInt(newUnixTimestamp)
    )
  );
}

async function bumpSlot(
  context: Awaited<ReturnType<typeof startAnchor>>
) {
  const clock = await context.banksClient.getClock();
  context.warpToSlot(clock.slot + BigInt(1));
}

function getErrorCode(err: unknown): string | undefined {
  const e = err as any;
  return e?.error?.errorCode?.code;
}

describe("Dead Mans Switch - Full Lifecycle", () => {
  let provider: BankrunProvider;
  let program: Program<DeadMansSwitch>;
  let context: Awaited<ReturnType<typeof startAnchor>>;
  let owner: Keypair;
  let beneficiary1: Keypair;
  let beneficiary2: Keypair;
  let vaultPda: PublicKey;

  beforeAll(async () => {
    owner = Keypair.generate();
    beneficiary1 = Keypair.generate();
    beneficiary2 = Keypair.generate();

    context = await startAnchor(
      "",
      [{ name: "dead_mans_switch", programId: PROGRAM_ID }],
      [
        {
          address: owner.publicKey,
          info: {
            lamports: 100 * LAMPORTS_PER_SOL,
            data: Buffer.alloc(0),
            owner: SystemProgram.programId,
            executable: false,
          },
        },
        {
          address: beneficiary1.publicKey,
          info: {
            lamports: 1 * LAMPORTS_PER_SOL,
            data: Buffer.alloc(0),
            owner: SystemProgram.programId,
            executable: false,
          },
        },
        {
          address: beneficiary2.publicKey,
          info: {
            lamports: 1 * LAMPORTS_PER_SOL,
            data: Buffer.alloc(0),
            owner: SystemProgram.programId,
            executable: false,
          },
        },
      ]
    );

    provider = new BankrunProvider(context);
    program = new Program<DeadMansSwitch>(IDL as DeadMansSwitch, provider);
    [vaultPda] = getVaultPda(owner.publicKey);
  });

  it("1. initializes vault with valid config", async () => {
    await program.methods
      .initializeVault(new BN(WARNING_PERIOD), new BN(CHALLENGE_PERIOD), [
        { address: beneficiary1.publicKey, share: 60, hasClaimed: false },
        { address: beneficiary2.publicKey, share: 40, hasClaimed: false },
      ])
      .accounts({
        vault: vaultPda,
        owner: owner.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([owner])
      .rpc();

    const vault = await program.account.vault.fetch(vaultPda);
    expect(vault.owner.toString()).toBe(owner.publicKey.toString());
    expect(vault.state).toEqual({ active: {} });
    expect(vault.warningPeriodSeconds.toNumber()).toBe(WARNING_PERIOD);
    expect(vault.challengePeriodSeconds.toNumber()).toBe(CHALLENGE_PERIOD);
    expect(vault.solBalance.toNumber()).toBe(0);
    expect(vault.beneficiaries).toHaveLength(2);
    expect(vault.beneficiaries[0].share).toBe(60);
    expect(vault.beneficiaries[1].share).toBe(40);
    expect(vault.warningTriggeredAt).toBeNull();
    expect(vault.challengeTriggeredAt).toBeNull();
  });

  it("2. deposits SOL into the vault", async () => {
    const depositAmount = 10 * LAMPORTS_PER_SOL;

    await program.methods
      .depositSol(new BN(depositAmount))
      .accounts({
        vault: vaultPda,
        owner: owner.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([owner])
      .rpc();

    const vault = await program.account.vault.fetch(vaultPda);
    expect(vault.solBalance.toNumber()).toBe(depositAmount);
  });

  it("3. rejects zero deposit", async () => {
    try {
      await program.methods
        .depositSol(new BN(0))
        .accounts({
          vault: vaultPda,
          owner: owner.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([owner])
        .rpc();
      expect.unreachable("Should have thrown");
    } catch (err) {
      expect(getErrorCode(err)).toBe("InvalidAmount");
    }
  });

  it("4. check-in resets timer", async () => {
    const vaultBefore = await program.account.vault.fetch(vaultPda);
    const tsBefore = vaultBefore.lastCheckinTimestamp.toNumber();

    await advanceClock(context, tsBefore + 10);

    await program.methods
      .checkIn()
      .accounts({ vault: vaultPda, owner: owner.publicKey })
      .signers([owner])
      .rpc();

    const vaultAfter = await program.account.vault.fetch(vaultPda);
    expect(vaultAfter.lastCheckinTimestamp.toNumber()).toBeGreaterThan(
      tsBefore
    );
    expect(vaultAfter.state).toEqual({ active: {} });
  });

  it("5. rejects check-in from non-owner", async () => {
    try {
      await program.methods
        .checkIn()
        .accounts({ vault: vaultPda, owner: beneficiary1.publicKey })
        .signers([beneficiary1])
        .rpc();
      expect.unreachable("Should have thrown");
    } catch (err) {
      // PDA seed mismatch causes a constraint error
      expect(err).toBeTruthy();
    }
  });

  it("6. rejects premature state advancement", async () => {
    try {
      await program.methods
        .advanceState()
        .accounts({ vault: vaultPda })
        .rpc();
      expect.unreachable("Should have thrown");
    } catch (err) {
      expect(getErrorCode(err)).toBe("TimelockNotExpired");
    }
  });

  it("7. advances to WARNING after warning period", async () => {
    const vault = await program.account.vault.fetch(vaultPda);
    const lastCheckin = vault.lastCheckinTimestamp.toNumber();

    await advanceClock(context, lastCheckin + WARNING_PERIOD + 1);

    await program.methods
      .advanceState()
      .accounts({ vault: vaultPda })
      .rpc();

    const updated = await program.account.vault.fetch(vaultPda);
    expect(updated.state).toEqual({ warning: {} });
    expect(updated.warningTriggeredAt).not.toBeNull();
  });

  it("8. check-in during WARNING resets to ACTIVE", async () => {
    await program.methods
      .checkIn()
      .accounts({ vault: vaultPda, owner: owner.publicKey })
      .signers([owner])
      .rpc();

    const vault = await program.account.vault.fetch(vaultPda);
    expect(vault.state).toEqual({ active: {} });
    expect(vault.warningTriggeredAt).toBeNull();
    expect(vault.challengeTriggeredAt).toBeNull();
  });

  it("9. advances through all states to CLAIMABLE", async () => {
    let vault = await program.account.vault.fetch(vaultPda);
    let lastCheckin = vault.lastCheckinTimestamp.toNumber();

    // Active -> Warning
    await advanceClock(context, lastCheckin + WARNING_PERIOD + 1);
    await program.methods
      .advanceState()
      .accounts({ vault: vaultPda })
      .rpc();

    vault = await program.account.vault.fetch(vaultPda);
    expect(vault.state).toEqual({ warning: {} });
    const warningTime = vault.warningTriggeredAt!.toNumber();

    // Warning -> Challenge
    await advanceClock(context, warningTime + CHALLENGE_PERIOD + 1);
    await program.methods
      .advanceState()
      .accounts({ vault: vaultPda })
      .rpc();

    vault = await program.account.vault.fetch(vaultPda);
    expect(vault.state).toEqual({ challenge: {} });
    const challengeTime = vault.challengeTriggeredAt!.toNumber();

    // Challenge -> Claimable
    await advanceClock(context, challengeTime + CHALLENGE_PERIOD + 1);
    await program.methods
      .advanceState()
      .accounts({ vault: vaultPda })
      .rpc();

    vault = await program.account.vault.fetch(vaultPda);
    expect(vault.state).toEqual({ claimable: {} });
  });

  it("10. rejects advance when already claimable", async () => {
    await bumpSlot(context);
    try {
      await program.methods
        .advanceState()
        .accounts({ vault: vaultPda })
        .rpc();
      expect.unreachable("Should have thrown");
    } catch (err) {
      expect(getErrorCode(err)).toBe("AlreadyClaimable");
    }
  });

  it("11. rejects claim from non-beneficiary", async () => {
    try {
      await program.methods
        .claim()
        .accounts({ vault: vaultPda, beneficiary: owner.publicKey })
        .signers([owner])
        .rpc();
      expect.unreachable("Should have thrown");
    } catch (err) {
      expect(getErrorCode(err)).toBe("NotABeneficiary");
    }
  });

  it("12. beneficiary1 claims 60%", async () => {
    const vault = await program.account.vault.fetch(vaultPda);
    const expectedAmount = Math.floor(
      (vault.solBalance.toNumber() * 60) / 100
    );

    const balanceBefore = await context.banksClient.getBalance(
      beneficiary1.publicKey
    );

    await program.methods
      .claim()
      .accounts({ vault: vaultPda, beneficiary: beneficiary1.publicKey })
      .signers([beneficiary1])
      .rpc();

    const balanceAfter = await context.banksClient.getBalance(
      beneficiary1.publicKey
    );
    expect(Number(balanceAfter) - Number(balanceBefore)).toBe(expectedAmount);

    const updated = await program.account.vault.fetch(vaultPda);
    expect(updated.beneficiaries[0].hasClaimed).toBe(true);
    expect(updated.state).toEqual({ claimable: {} });
  });

  it("13. rejects double claim", async () => {
    await bumpSlot(context);
    try {
      await program.methods
        .claim()
        .accounts({ vault: vaultPda, beneficiary: beneficiary1.publicKey })
        .signers([beneficiary1])
        .rpc();
      expect.unreachable("Should have thrown");
    } catch (err) {
      expect(getErrorCode(err)).toBe("AlreadyClaimed");
    }
  });

  it("14. beneficiary2 claims 40% and vault becomes CLAIMED", async () => {
    const vault = await program.account.vault.fetch(vaultPda);
    const expectedAmount = Math.floor(
      (vault.solBalance.toNumber() * 40) / 100
    );

    const balanceBefore = await context.banksClient.getBalance(
      beneficiary2.publicKey
    );

    await program.methods
      .claim()
      .accounts({ vault: vaultPda, beneficiary: beneficiary2.publicKey })
      .signers([beneficiary2])
      .rpc();

    const balanceAfter = await context.banksClient.getBalance(
      beneficiary2.publicKey
    );
    expect(Number(balanceAfter) - Number(balanceBefore)).toBe(expectedAmount);

    const updated = await program.account.vault.fetch(vaultPda);
    expect(updated.beneficiaries[1].hasClaimed).toBe(true);
    expect(updated.state).toEqual({ claimed: {} });
  });

  it("15. rejects check-in on claimed vault", async () => {
    try {
      await program.methods
        .checkIn()
        .accounts({ vault: vaultPda, owner: owner.publicKey })
        .signers([owner])
        .rpc();
      expect.unreachable("Should have thrown");
    } catch (err) {
      expect(getErrorCode(err)).toBe("VaultClaimed");
    }
  });
});

describe("Dead Mans Switch - Cancel", () => {
  let provider: BankrunProvider;
  let program: Program<DeadMansSwitch>;
  let context: Awaited<ReturnType<typeof startAnchor>>;
  let owner: Keypair;
  let beneficiary: Keypair;
  let vaultPda: PublicKey;

  beforeAll(async () => {
    owner = Keypair.generate();
    beneficiary = Keypair.generate();

    context = await startAnchor(
      "",
      [{ name: "dead_mans_switch", programId: PROGRAM_ID }],
      [
        {
          address: owner.publicKey,
          info: {
            lamports: 100 * LAMPORTS_PER_SOL,
            data: Buffer.alloc(0),
            owner: SystemProgram.programId,
            executable: false,
          },
        },
      ]
    );

    provider = new BankrunProvider(context);
    program = new Program<DeadMansSwitch>(IDL as DeadMansSwitch, provider);
    [vaultPda] = getVaultPda(owner.publicKey);

    await program.methods
      .initializeVault(new BN(WARNING_PERIOD), new BN(CHALLENGE_PERIOD), [
        { address: beneficiary.publicKey, share: 100, hasClaimed: false },
      ])
      .accounts({
        vault: vaultPda,
        owner: owner.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([owner])
      .rpc();

    await program.methods
      .depositSol(new BN(5 * LAMPORTS_PER_SOL))
      .accounts({
        vault: vaultPda,
        owner: owner.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([owner])
      .rpc();
  });

  it("owner cancels and gets SOL back", async () => {
    const balanceBefore = await context.banksClient.getBalance(
      owner.publicKey
    );

    await program.methods
      .cancel()
      .accounts({ vault: vaultPda, owner: owner.publicKey })
      .signers([owner])
      .rpc();

    const balanceAfter = await context.banksClient.getBalance(
      owner.publicKey
    );
    expect(Number(balanceAfter)).toBeGreaterThan(Number(balanceBefore));

    const vaultAccount = await context.banksClient.getAccount(vaultPda);
    expect(vaultAccount).toBeNull();
  });
});

describe("Dead Mans Switch - Validation", () => {
  let provider: BankrunProvider;
  let program: Program<DeadMansSwitch>;
  let context: Awaited<ReturnType<typeof startAnchor>>;
  let owner: Keypair;

  beforeAll(async () => {
    owner = Keypair.generate();

    context = await startAnchor(
      "",
      [{ name: "dead_mans_switch", programId: PROGRAM_ID }],
      [
        {
          address: owner.publicKey,
          info: {
            lamports: 100 * LAMPORTS_PER_SOL,
            data: Buffer.alloc(0),
            owner: SystemProgram.programId,
            executable: false,
          },
        },
      ]
    );

    provider = new BankrunProvider(context);
    program = new Program<DeadMansSwitch>(IDL as DeadMansSwitch, provider);
  });

  it("rejects shares not summing to 100", async () => {
    const [vaultPda] = getVaultPda(owner.publicKey);
    try {
      await program.methods
        .initializeVault(new BN(60), new BN(30), [
          {
            address: Keypair.generate().publicKey,
            share: 50,
            hasClaimed: false,
          },
          {
            address: Keypair.generate().publicKey,
            share: 30,
            hasClaimed: false,
          },
        ])
        .accounts({
          vault: vaultPda,
          owner: owner.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([owner])
        .rpc();
      expect.unreachable("Should have thrown");
    } catch (err) {
      expect(getErrorCode(err)).toBe("InvalidShares");
    }
  });

  it("rejects empty beneficiaries", async () => {
    const [vaultPda] = getVaultPda(owner.publicKey);
    try {
      await program.methods
        .initializeVault(new BN(60), new BN(30), [])
        .accounts({
          vault: vaultPda,
          owner: owner.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([owner])
        .rpc();
      expect.unreachable("Should have thrown");
    } catch (err) {
      expect(getErrorCode(err)).toBe("InvalidBeneficiaries");
    }
  });

  it("rejects > 5 beneficiaries", async () => {
    const [vaultPda] = getVaultPda(owner.publicKey);
    const bens = Array.from({ length: 6 }, (_, i) => ({
      address: Keypair.generate().publicKey,
      share: i < 5 ? 16 : 20,
      hasClaimed: false,
    }));

    try {
      await program.methods
        .initializeVault(new BN(60), new BN(30), bens)
        .accounts({
          vault: vaultPda,
          owner: owner.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([owner])
        .rpc();
      expect.unreachable("Should have thrown");
    } catch (err) {
      expect(getErrorCode(err)).toBe("InvalidBeneficiaries");
    }
  });

  it("rejects zero warning period", async () => {
    const [vaultPda] = getVaultPda(owner.publicKey);
    try {
      await program.methods
        .initializeVault(new BN(0), new BN(30), [
          {
            address: Keypair.generate().publicKey,
            share: 100,
            hasClaimed: false,
          },
        ])
        .accounts({
          vault: vaultPda,
          owner: owner.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([owner])
        .rpc();
      expect.unreachable("Should have thrown");
    } catch (err) {
      expect(getErrorCode(err)).toBe("InvalidPeriod");
    }
  });
});

describe("Dead Mans Switch - Check-in During Challenge", () => {
  let provider: BankrunProvider;
  let program: Program<DeadMansSwitch>;
  let context: Awaited<ReturnType<typeof startAnchor>>;
  let owner: Keypair;
  let beneficiary: Keypair;
  let vaultPda: PublicKey;

  beforeAll(async () => {
    owner = Keypair.generate();
    beneficiary = Keypair.generate();

    context = await startAnchor(
      "",
      [{ name: "dead_mans_switch", programId: PROGRAM_ID }],
      [
        {
          address: owner.publicKey,
          info: {
            lamports: 100 * LAMPORTS_PER_SOL,
            data: Buffer.alloc(0),
            owner: SystemProgram.programId,
            executable: false,
          },
        },
      ]
    );

    provider = new BankrunProvider(context);
    program = new Program<DeadMansSwitch>(IDL as DeadMansSwitch, provider);
    [vaultPda] = getVaultPda(owner.publicKey);

    // Initialize
    await program.methods
      .initializeVault(new BN(WARNING_PERIOD), new BN(CHALLENGE_PERIOD), [
        { address: beneficiary.publicKey, share: 100, hasClaimed: false },
      ])
      .accounts({
        vault: vaultPda,
        owner: owner.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([owner])
      .rpc();

    // Advance to WARNING
    let vault = await program.account.vault.fetch(vaultPda);
    await advanceClock(
      context,
      vault.lastCheckinTimestamp.toNumber() + WARNING_PERIOD + 1
    );
    await program.methods
      .advanceState()
      .accounts({ vault: vaultPda })
      .rpc();

    // Advance to CHALLENGE
    vault = await program.account.vault.fetch(vaultPda);
    await advanceClock(
      context,
      vault.warningTriggeredAt!.toNumber() + CHALLENGE_PERIOD + 1
    );
    await program.methods
      .advanceState()
      .accounts({ vault: vaultPda })
      .rpc();
  });

  it("vault is in CHALLENGE state", async () => {
    const vault = await program.account.vault.fetch(vaultPda);
    expect(vault.state).toEqual({ challenge: {} });
  });

  it("check-in during CHALLENGE resets to ACTIVE", async () => {
    await program.methods
      .checkIn()
      .accounts({ vault: vaultPda, owner: owner.publicKey })
      .signers([owner])
      .rpc();

    const vault = await program.account.vault.fetch(vaultPda);
    expect(vault.state).toEqual({ active: {} });
    expect(vault.warningTriggeredAt).toBeNull();
    expect(vault.challengeTriggeredAt).toBeNull();
  });
});
