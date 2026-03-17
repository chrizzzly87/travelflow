import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const tripViewSource = readFileSync(
  resolve(process.cwd(), "components/TripView.tsx"),
  "utf8",
);

describe("TripView security recovery ordering", () => {
  it("declares recovery callbacks before building the security recovery banner", () => {
    const bannerIndex = tripViewSource.indexOf(
      "const securityRecoveryBanner = useMemo",
    );
    const callbackMarkers = [
      "const handleSecurityRecoveryFieldChange = useCallback",
      "const handleOpenSecurityRecoveryReview = useCallback",
      "const handleCancelSecurityRecoveryReview = useCallback",
      "const handleClearSecurityRecoveryFields = useCallback",
      "const handleRetryWithSecurityRecovery = useCallback",
    ];

    expect(bannerIndex).toBeGreaterThan(-1);
    for (const marker of callbackMarkers) {
      const callbackIndex = tripViewSource.indexOf(marker);
      expect(callbackIndex).toBeGreaterThan(-1);
      expect(callbackIndex).toBeLessThan(bannerIndex);
    }
  });
});
