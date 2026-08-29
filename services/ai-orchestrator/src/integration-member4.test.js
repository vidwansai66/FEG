import { describe, it, expect, afterAll } from "vitest";
import { getCurrentOdds } from "./sportsClient.js";
import { createDraftSlip, validateDraftSlip, BACKEND_URL } from "./backendClient.js";
describe("Live Integration Tests against Member 3 & Member 4", () => {
    let createdSlipId = null;
    afterAll(async () => {
        // Cleanup draft slip created during the test
        if (createdSlipId) {
            try {
                await fetch(`${BACKEND_URL}/api/slips/${createdSlipId}`, { method: "DELETE" });
            }
            catch (e) {
                console.error("Cleanup failed", e);
            }
        }
    });
    it("should perform a full end-to-end resolution and validate on backend", async () => {
        const eventId = "evt_003_arsenal_manchester_city";
        const marketId = "mkt_003_arsenal_manchester_city_match_result";
        const selectionId = "sel_003_arsenal_manchester_city_match_result_home";
        // Fetch odds directly using canonical selection
        const odds = await getCurrentOdds({ selectionIds: [selectionId] });
        expect(odds.length).toBe(1);
        // Create Draft on Member 4
        const draftSlip = await createDraftSlip({
            stake: 100,
            legs: [
                {
                    eventId,
                    marketId,
                    selectionId,
                    acceptedOdds: odds[0].decimalOdds,
                    oddsTimestamp: new Date().toISOString(), // Member 3 might not return a timestamp here, so we use now
                    eventLabel: "Arsenal vs Manchester City",
                    marketLabel: "Match Result",
                    selectionLabel: "Arsenal"
                }
            ]
        });
        expect(draftSlip).toBeDefined();
        expect(draftSlip.id).toBeDefined();
        createdSlipId = draftSlip.id;
        // 6. Validate Draft on Member 4
        const validationResult = await validateDraftSlip(createdSlipId);
        expect(validationResult.ok).toBe(true);
        expect(validationResult.data.status).toBe("VALIDATED");
        expect(validationResult.data.slipId).toBe(createdSlipId);
        expect(typeof validationResult.data.totalOdds).toBe("number");
    }, 15000); // Increased timeout to 15s
    it("should fail validation for an invalid slip (negative case)", async () => {
        // Create a draft with intentionally invalid odds
        const invalidSlip = await createDraftSlip({
            stake: 100,
            legs: [
                {
                    eventId: "evt_003_arsenal_manchester_city",
                    marketId: "mkt_003_match_result",
                    selectionId: "sel_003_arsenal",
                    acceptedOdds: 999.99, // Highly likely to be rejected as odds changed
                    oddsTimestamp: new Date().toISOString(),
                    eventLabel: "Arsenal vs Manchester City",
                    marketLabel: "Match Result",
                    selectionLabel: "Arsenal"
                }
            ]
        });
        expect(invalidSlip).toBeDefined();
        expect(invalidSlip.id).toBeDefined();
        const validationResult = await validateDraftSlip(invalidSlip.id);
        // Cleanup immediately since we don't track it in afterAll
        await fetch(`${BACKEND_URL}/api/slips/${invalidSlip.id}`, { method: "DELETE" }).catch(() => { });
        expect(validationResult.ok).toBe(true);
        expect(validationResult.data.status).toBe("INVALID");
        expect(Array.isArray(validationResult.data.issues)).toBe(true);
    }, 10000);
});
//# sourceMappingURL=integration-member4.test.js.map