import { VaultStateLabel } from "../types";
import { VaultData } from "../solana/vault-reader";

export interface StateEvaluation {
  currentState: VaultStateLabel;
  canAdvance: boolean;
  nextState: VaultStateLabel | null;
  secondsUntilAdvance: number | null;
}

/**
 * Pure function: given vault data + current time, determines if the vault
 * state can be advanced and how long until it can.
 *
 * State machine:
 *   Active → Warning: after warningPeriodSeconds since lastCheckinTimestamp
 *   Warning → Challenge: after challengePeriodSeconds since warningTriggeredAt
 *   Challenge → Claimable: after challengePeriodSeconds since challengeTriggeredAt
 *   Claimable/Claimed: terminal, no further advancement
 */
export function evaluateVaultState(
  vault: VaultData,
  nowUnix: number
): StateEvaluation {
  switch (vault.state) {
    case "active": {
      const deadline = vault.lastCheckinTimestamp + vault.warningPeriodSeconds;
      const remaining = deadline - nowUnix;
      return {
        currentState: "active",
        canAdvance: remaining <= 0,
        nextState: "warning",
        secondsUntilAdvance: remaining > 0 ? remaining : 0,
      };
    }

    case "warning": {
      if (vault.warningTriggeredAt == null) {
        return {
          currentState: "warning",
          canAdvance: false,
          nextState: "challenge",
          secondsUntilAdvance: null,
        };
      }
      const deadline =
        vault.warningTriggeredAt + vault.challengePeriodSeconds;
      const remaining = deadline - nowUnix;
      return {
        currentState: "warning",
        canAdvance: remaining <= 0,
        nextState: "challenge",
        secondsUntilAdvance: remaining > 0 ? remaining : 0,
      };
    }

    case "challenge": {
      if (vault.challengeTriggeredAt == null) {
        return {
          currentState: "challenge",
          canAdvance: false,
          nextState: "claimable",
          secondsUntilAdvance: null,
        };
      }
      const deadline =
        vault.challengeTriggeredAt + vault.challengePeriodSeconds;
      const remaining = deadline - nowUnix;
      return {
        currentState: "challenge",
        canAdvance: remaining <= 0,
        nextState: "claimable",
        secondsUntilAdvance: remaining > 0 ? remaining : 0,
      };
    }

    case "claimable":
      return {
        currentState: "claimable",
        canAdvance: false,
        nextState: null,
        secondsUntilAdvance: null,
      };

    case "claimed":
      return {
        currentState: "claimed",
        canAdvance: false,
        nextState: null,
        secondsUntilAdvance: null,
      };
  }
}
