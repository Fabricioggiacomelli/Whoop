import { describe, expect, it } from "vitest";

import { getRecoveryModeAdjustment } from "@/server/scoring/recoveryModeAdjustment";

describe("getRecoveryModeAdjustment", () => {
  it("never reduces the ceiling when no recovery mode is active", () => {
    const adjustment = getRecoveryModeAdjustment(null);
    expect(adjustment.strainCeilingMultiplier).toBe(1);
    expect(adjustment.treatRestAsGoodConsistency).toBe(false);
  });

  it("reduces the strain ceiling most for SICK", () => {
    const sick = getRecoveryModeAdjustment({ type: "SICK" });
    const injured = getRecoveryModeAdjustment({ type: "INJURED" });
    const general = getRecoveryModeAdjustment({ type: "GENERAL_RECOVERY" });

    expect(sick.strainCeilingMultiplier).toBeLessThan(injured.strainCeilingMultiplier);
    expect(injured.strainCeilingMultiplier).toBeLessThan(general.strainCeilingMultiplier);
    expect(general.strainCeilingMultiplier).toBeLessThan(1);
  });

  it("always treats rest as good consistency while any mode is active", () => {
    for (const type of ["INJURED", "SICK", "GENERAL_RECOVERY"] as const) {
      expect(getRecoveryModeAdjustment({ type }).treatRestAsGoodConsistency).toBe(true);
    }
  });
});
