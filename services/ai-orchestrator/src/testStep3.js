import { resolveSelectionIntent } from "./agent.js";
async function runTest() {
    console.log("=== STEP 8 TEST: Resolving Selection Intents ===\n");
    console.log("--- 1. One Matching Selection ---");
    // 'Arsenal' should exactly match Arsenal to win in mkt_2001
    const result1 = await resolveSelectionIntent("evt_1001", "mkt_2001", "Arsenal");
    console.log(JSON.stringify(result1, null, 2));
    console.log("\n--- 2. No Matching Selection ---");
    // 'Unknown Team' doesn't match anything in mkt_2001
    const result2 = await resolveSelectionIntent("evt_1001", "mkt_2001", "Unknown Team");
    console.log(JSON.stringify(result2, null, 2));
    console.log("\n--- 3. Multiple Matching Selections (Ambiguity) ---");
    // 'London' matches both Arsenal and Chelsea in our mock definition
    const result3 = await resolveSelectionIntent("evt_1001", "mkt_2001", "London");
    console.log(JSON.stringify(result3, null, 2));
}
runTest().catch(console.error);
//# sourceMappingURL=testStep3.js.map