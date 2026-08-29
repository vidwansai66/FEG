import { processUserMessage } from "./agent.js";
async function runTest() {
    console.log("=== STEP 13 TEST: Error and Timeout Handling ===\n");
    const buildIntent = (query, step) => {
        return {
            action: "build_draft_slip",
            legs: [
                {
                    eventQuery: step === "event" ? query : "Arsenal",
                    marketQuery: step === "market" ? query : "Match Result",
                    selectionQuery: step === "selection" ? query : "Arsenal"
                }
            ]
        };
    };
    // Test 1: Event Tool Error
    console.log("--- 1. Event Tool Error ---");
    const res1 = await processUserMessage("sess-1", "", buildIntent("error_event", "event"));
    console.log("Result 1:", JSON.stringify(res1, null, 2));
    // Test 2: Market Tool Error
    console.log("\n--- 2. Market Tool Error ---");
    const res2 = await processUserMessage("sess-2", "", buildIntent("error_market", "market"));
    console.log("Result 2:", JSON.stringify(res2, null, 2));
    // Test 3: Selection Tool Error
    console.log("\n--- 3. Selection Tool Error ---");
    const res3 = await processUserMessage("sess-3", "", buildIntent("error_selection", "selection"));
    console.log("Result 3:", JSON.stringify(res3, null, 2));
    // Test 4: Odds Tool Error
    console.log("\n--- 4. Odds Tool Error ---");
    const res4 = await processUserMessage("sess-4", "", buildIntent("odds_fail", "selection"));
    console.log("Result 4:", JSON.stringify(res4, null, 2));
    // Test 5: Timeout (Event tool)
    console.log("\n--- 5. Timeout (Event tool) ---");
    const res5 = await processUserMessage("sess-5", "", buildIntent("timeout_event", "event"));
    console.log("Result 5:", JSON.stringify(res5, null, 2));
    // Test 6: Retry Succeeds (Odds tool)
    console.log("\n--- 6. Retry Succeeds (Odds tool) ---");
    const res6 = await processUserMessage("sess-6", "", buildIntent("odds_retry", "selection"));
    console.log("Result 6:", JSON.stringify(res6, null, 2));
    // Test 7: Malformed Result (Event tool)
    console.log("\n--- 7. Malformed Result (Event tool) ---");
    const res7 = await processUserMessage("sess-7", "", buildIntent("malformed_event", "event"));
    console.log("Result 7:", JSON.stringify(res7, null, 2));
}
runTest().catch(console.error);
//# sourceMappingURL=testStep8.js.map