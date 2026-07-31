import { describe, expect, it } from "vitest";

import { evaluateInviteRedeemability } from "@/lib/invite-rules";

const NOW = new Date("2026-07-30T12:00:00Z");
const FUTURE = new Date("2026-08-30T12:00:00Z");
const PAST = new Date("2026-01-01T12:00:00Z");

describe("evaluateInviteRedeemability", () => {
  it("allows a fresh, unused, non-revoked invite", () => {
    const reason = evaluateInviteRedeemability(
      { revokedAt: null, usedById: null, expiresAt: FUTURE },
      NOW,
    );
    expect(reason).toBeNull();
  });

  it("rejects a revoked invite even if it hasn't expired", () => {
    const reason = evaluateInviteRedeemability(
      { revokedAt: new Date("2026-07-01T00:00:00Z"), usedById: null, expiresAt: FUTURE },
      NOW,
    );
    expect(reason).toBe("REVOKED");
  });

  it("rejects an already-used invite", () => {
    const reason = evaluateInviteRedeemability(
      { revokedAt: null, usedById: "user-123", expiresAt: FUTURE },
      NOW,
    );
    expect(reason).toBe("ALREADY_USED");
  });

  it("rejects an expired invite", () => {
    const reason = evaluateInviteRedeemability(
      { revokedAt: null, usedById: null, expiresAt: PAST },
      NOW,
    );
    expect(reason).toBe("EXPIRED");
  });

  it("checks revocation before expiry/usage (priority order)", () => {
    const reason = evaluateInviteRedeemability(
      { revokedAt: new Date("2026-01-01T00:00:00Z"), usedById: "user-123", expiresAt: PAST },
      NOW,
    );
    expect(reason).toBe("REVOKED");
  });
});
