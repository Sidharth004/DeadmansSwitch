import { VaultStateLabel } from "../types";

interface TemplateData {
  ownerAddress: string;
  vaultPda: string;
  appUrl: string;
  secondsRemaining?: number | null;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400)
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`;
}

export function getTelegramMessage(
  newState: VaultStateLabel,
  data: TemplateData
): string {
  const vaultShort = data.vaultPda.slice(0, 8) + "...";

  switch (newState) {
    case "warning":
      return [
        `⚠️ *Warning State Activated*`,
        ``,
        `Vault \`${vaultShort}\` has entered the *warning* phase.`,
        `The owner has not checked in within the warning period.`,
        ``,
        `If no check-in occurs, the vault will advance to *challenge* state.`,
        ``,
        `🔗 [Check in now](${data.appUrl})`,
      ].join("\n");

    case "challenge":
      return [
        `🔴 *Challenge State Activated*`,
        ``,
        `Vault \`${vaultShort}\` has entered the *challenge* phase.`,
        `This is the final opportunity for the owner to check in.`,
        ``,
        `If no action is taken, funds will become *claimable* by beneficiaries.`,
        ``,
        `🔗 [Check in now](${data.appUrl})`,
      ].join("\n");

    case "claimable":
      return [
        `🏦 *Vault Now Claimable*`,
        ``,
        `Vault \`${vaultShort}\` is now *claimable*.`,
        `Beneficiaries can claim their allocated shares.`,
        ``,
        `🔗 [Claim funds](${data.appUrl})`,
      ].join("\n");

    case "active":
      return [
        `✅ *Check-in Confirmed*`,
        ``,
        `Vault \`${vaultShort}\` is back to *active* state.`,
        `Timer has been reset.`,
      ].join("\n");

    default:
      return `Vault \`${vaultShort}\` state changed to *${newState}*.`;
  }
}

export function getEmailSubject(newState: VaultStateLabel): string {
  switch (newState) {
    case "warning":
      return "Dead Man's Switch — Warning: Check-in required";
    case "challenge":
      return "Dead Man's Switch — URGENT: Challenge phase activated";
    case "claimable":
      return "Dead Man's Switch — Vault is now claimable";
    case "active":
      return "Dead Man's Switch — Check-in confirmed";
    default:
      return `Dead Man's Switch — State changed to ${newState}`;
  }
}

export function getEmailBody(
  newState: VaultStateLabel,
  data: TemplateData
): string {
  switch (newState) {
    case "warning":
      return [
        `Your Dead Man's Switch vault (${data.vaultPda}) has entered the WARNING state.`,
        ``,
        `The vault owner has not checked in within the configured warning period.`,
        `If no check-in occurs, the vault will advance to the challenge state.`,
        ``,
        `Check in at: ${data.appUrl}`,
      ].join("\n");

    case "challenge":
      return [
        `URGENT: Your Dead Man's Switch vault (${data.vaultPda}) has entered the CHALLENGE state.`,
        ``,
        `This is the final opportunity for the owner to check in.`,
        `If no action is taken, funds will become claimable by beneficiaries.`,
        ``,
        `Check in at: ${data.appUrl}`,
      ].join("\n");

    case "claimable":
      return [
        `Your Dead Man's Switch vault (${data.vaultPda}) is now CLAIMABLE.`,
        ``,
        `Beneficiaries can now claim their allocated shares of the vault.`,
        ``,
        `Visit: ${data.appUrl}`,
      ].join("\n");

    default:
      return `Vault ${data.vaultPda} state changed to ${newState}.\n\nVisit: ${data.appUrl}`;
  }
}
