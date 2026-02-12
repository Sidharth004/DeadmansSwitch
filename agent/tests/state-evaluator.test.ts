import { evaluateVaultState } from "../src/monitor/state-evaluator";
import { VaultData } from "../src/solana/vault-reader";
import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

function makeVault(overrides: Partial<VaultData> = {}): VaultData {
  return {
    owner: PublicKey.default,
    state: "active",
    rawState: { active: {} },
    warningPeriodSeconds: 86400, // 1 day
    challengePeriodSeconds: 43200, // 12 hours
    lastCheckinTimestamp: 1000000,
    warningTriggeredAt: null,
    challengeTriggeredAt: null,
    solBalance: new BN(1000000000),
    beneficiaries: [],
    bump: 255,
    pda: PublicKey.default,
    ...overrides,
  };
}

describe("evaluateVaultState", () => {
  describe("Active state", () => {
    it("cannot advance before warning period expires", () => {
      const vault = makeVault({ state: "active", lastCheckinTimestamp: 1000000 });
      const now = 1000000 + 86400 - 100; // 100s before deadline

      const result = evaluateVaultState(vault, now);
      expect(result.currentState).toBe("active");
      expect(result.canAdvance).toBe(false);
      expect(result.nextState).toBe("warning");
      expect(result.secondsUntilAdvance).toBe(100);
    });

    it("can advance after warning period expires", () => {
      const vault = makeVault({ state: "active", lastCheckinTimestamp: 1000000 });
      const now = 1000000 + 86400 + 1; // 1s after deadline

      const result = evaluateVaultState(vault, now);
      expect(result.currentState).toBe("active");
      expect(result.canAdvance).toBe(true);
      expect(result.nextState).toBe("warning");
      expect(result.secondsUntilAdvance).toBe(0);
    });

    it("can advance at exact deadline", () => {
      const vault = makeVault({ state: "active", lastCheckinTimestamp: 1000000 });
      const now = 1000000 + 86400;

      const result = evaluateVaultState(vault, now);
      expect(result.canAdvance).toBe(true);
    });
  });

  describe("Warning state", () => {
    it("cannot advance before challenge period expires", () => {
      const vault = makeVault({
        state: "warning",
        warningTriggeredAt: 2000000,
      });
      const now = 2000000 + 43200 - 500;

      const result = evaluateVaultState(vault, now);
      expect(result.currentState).toBe("warning");
      expect(result.canAdvance).toBe(false);
      expect(result.nextState).toBe("challenge");
      expect(result.secondsUntilAdvance).toBe(500);
    });

    it("can advance after challenge period expires", () => {
      const vault = makeVault({
        state: "warning",
        warningTriggeredAt: 2000000,
      });
      const now = 2000000 + 43200 + 1;

      const result = evaluateVaultState(vault, now);
      expect(result.canAdvance).toBe(true);
      expect(result.nextState).toBe("challenge");
    });

    it("handles null warningTriggeredAt gracefully", () => {
      const vault = makeVault({
        state: "warning",
        warningTriggeredAt: null,
      });
      const now = 9999999;

      const result = evaluateVaultState(vault, now);
      expect(result.canAdvance).toBe(false);
      expect(result.secondsUntilAdvance).toBeNull();
    });
  });

  describe("Challenge state", () => {
    it("cannot advance before challenge period expires", () => {
      const vault = makeVault({
        state: "challenge",
        challengeTriggeredAt: 3000000,
      });
      const now = 3000000 + 43200 - 1000;

      const result = evaluateVaultState(vault, now);
      expect(result.currentState).toBe("challenge");
      expect(result.canAdvance).toBe(false);
      expect(result.nextState).toBe("claimable");
      expect(result.secondsUntilAdvance).toBe(1000);
    });

    it("can advance after challenge period expires", () => {
      const vault = makeVault({
        state: "challenge",
        challengeTriggeredAt: 3000000,
      });
      const now = 3000000 + 43200 + 1;

      const result = evaluateVaultState(vault, now);
      expect(result.canAdvance).toBe(true);
      expect(result.nextState).toBe("claimable");
    });

    it("handles null challengeTriggeredAt gracefully", () => {
      const vault = makeVault({
        state: "challenge",
        challengeTriggeredAt: null,
      });

      const result = evaluateVaultState(vault, 9999999);
      expect(result.canAdvance).toBe(false);
      expect(result.secondsUntilAdvance).toBeNull();
    });
  });

  describe("Terminal states", () => {
    it("claimable cannot advance", () => {
      const vault = makeVault({ state: "claimable" });

      const result = evaluateVaultState(vault, 9999999);
      expect(result.currentState).toBe("claimable");
      expect(result.canAdvance).toBe(false);
      expect(result.nextState).toBeNull();
      expect(result.secondsUntilAdvance).toBeNull();
    });

    it("claimed cannot advance", () => {
      const vault = makeVault({ state: "claimed" });

      const result = evaluateVaultState(vault, 9999999);
      expect(result.currentState).toBe("claimed");
      expect(result.canAdvance).toBe(false);
      expect(result.nextState).toBeNull();
      expect(result.secondsUntilAdvance).toBeNull();
    });
  });
});
