export type InviteRedeemabilityInput = {
  revokedAt: Date | null;
  usedById: string | null;
  expiresAt: Date;
};

export type InviteRedeemabilityReason = "REVOKED" | "ALREADY_USED" | "EXPIRED" | null;

/** Regra pura (sem I/O) de validade de um convite — usada pelo invite.service e testada isoladamente. */
export function evaluateInviteRedeemability(
  invite: InviteRedeemabilityInput,
  now: Date = new Date(),
): InviteRedeemabilityReason {
  if (invite.revokedAt) return "REVOKED";
  if (invite.usedById) return "ALREADY_USED";
  if (invite.expiresAt < now) return "EXPIRED";
  return null;
}
