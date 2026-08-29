import { resolveEventIntent } from "./agent.js";
async function runTest() {
    console.log("=== STEP 6 TEST: Resolving Event Intents ===\n");
    console.log("--- 1. One Matching Event ---");
    const result1 = await resolveEventIntent("Arsenal vs Chelsea");
    console.log(JSON.stringify(result1, null, 2));
    console.log("\n--- 2. No Matching Event ---");
    const result2 = await resolveEventIntent("Random Unknown Team");
    console.log(JSON.stringify(result2, null, 2));
    console.log("\n--- 3. Multiple Matching Events (Ambiguity) ---");
    const result3 = await resolveEventIntent("Manchester");
    console.log(JSON.stringify(result3, null, 2));
}
runTest().catch(console.error);
//# sourceMappingURL=testStep1.js.map