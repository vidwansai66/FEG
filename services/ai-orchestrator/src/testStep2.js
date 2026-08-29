import { resolveMarketIntent } from "./agent.js";
async function runTest() {
    console.log("=== STEP 7 TEST: Resolving Market Intents ===\n");
    console.log("--- 1. One Matching Market ---");
    // evt_1001 (Arsenal vs Chelsea) only has the MATCH_RESULT market defined
    const result1 = await resolveMarketIntent("evt_1001", "match winner");
    console.log(JSON.stringify(result1, null, 2));
    console.log("\n--- 2. No Matching Market ---");
    // evt_9999 doesn't exist in our mock markets
    const result2 = await resolveMarketIntent("evt_9999", "anything");
    console.log(JSON.stringify(result2, null, 2));
    console.log("\n--- 3. Multiple Matching Markets (Ambiguity) ---");
    // evt_1003 has two markets defined in our mock to simulate ambiguity
    const result3 = await resolveMarketIntent("evt_1003", "all markets");
    console.log(JSON.stringify(result3, null, 2));
}
runTest().catch(console.error);
//# sourceMappingURL=testStep2.js.map