import { resolveOddsIntent } from "./agent.js";
async function runTest() {
    console.log("=== STEP 9 TEST: Fetching Current Odds ===\n");
    console.log("--- 1. One Selection with Odds ---");
    // 'sel_3001' is Arsenal
    const result1 = await resolveOddsIntent(["sel_3001"]);
    console.log(JSON.stringify(result1, null, 2));
    console.log("\n--- 2. Multiple Selections with Odds ---");
    // 'sel_3001' and 'sel_3003' are Arsenal and BTTS Yes
    const result2 = await resolveOddsIntent(["sel_3001", "sel_3003"]);
    console.log(JSON.stringify(result2, null, 2));
    console.log("\n--- 3. Unknown Selection ID ---");
    const result3 = await resolveOddsIntent(["sel_9999"]);
    console.log(JSON.stringify(result3, null, 2));
}
runTest().catch(console.error);
//# sourceMappingURL=testStep4.js.map