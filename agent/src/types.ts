export type VaultStateLabel =
  | "active"
  | "warning"
  | "challenge"
  | "claimable"
  | "claimed";

/**
 * Converts Anchor's enum format (e.g. { active: {} }) to a simple string label.
 */
export function getStateLabel(state: Record<string, unknown>): VaultStateLabel {
  const key = Object.keys(state)[0];
  if (!key) throw new Error("Invalid vault state object");
  return key.toLowerCase() as VaultStateLabel;
}
