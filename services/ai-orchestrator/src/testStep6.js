import { processUserMessage } from "./agent.js";
async function runTest() {
    console.log("=== STEP 11 TEST: Clarification Handling ===\n");
    // Test 1: Ambiguous Intent
    console.log("--- 1. Two event candidates → NEEDS_CLARIFICATION ---");
    const ambiguousIntent = {
        action: "build_draft_slip",
        stake: 20,
        legs: [
            { eventQuery: "Manchester", marketQuery: "Match Result", selectionQuery: "Man City" }
        ]
    };
    const result1 = await processUserMessage("session-A", "", ambiguousIntent);
    console.log("Result 1 Status:", result1.status); // should be NEEDS_CLARIFICATION
    // Test 2: User answers "2"
    console.log("\n--- 2. User answers '2' → correct candidate selected ---");
    const result2 = await processUserMessage("session-A", "2");
    console.log("Result 2 Status:", result2.status); // should be NOT_FOUND (because market not mocked for evt_1004)
    if (result2.status === "NOT_FOUND" && "step" in result2) {
        console.log(`Failed at step: ${result2.step} (${result2.message})`);
    }
    // Test 3: Invalid answer "5"
    console.log("\n--- 3. Invalid answer '5' → clarification remains pending ---");
    await processUserMessage("session-B", "", ambiguousIntent); // recreate ambiguity
    const result3 = await processUserMessage("session-B", "5");
    console.log("Result 3:", JSON.stringify(result3, null, 2));
    // Test 4: Natural language clarification matching a candidate
    console.log("\n--- 4. Natural language clarification matching a candidate ---");
    const result4 = await processUserMessage("session-B", "manchester united"); // mkt_2003 and mkt_2004 will cause market ambiguity!
    console.log("Result 4 Status:", result4.status);
    if (result4.status === "NEEDS_CLARIFICATION" && "step" in result4) {
        console.log("Needs clarification for step:", result4.step);
    }
    // Test 5: Ambiguous selection clarification
    console.log("\n--- 5. Ambiguous selection clarification ---");
    const selectionAmbiguityIntent = {
        action: "build_draft_slip",
        legs: [
            { eventQuery: "Arsenal vs Chelsea", marketQuery: "Match Result", selectionQuery: "London" }
        ]
    };
    const result5 = await processUserMessage("session-C", "", selectionAmbiguityIntent);
    console.log("Result 5 Status:", result5.status); // Should be NEEDS_CLARIFICATION for selection
    if (result5.status === "NEEDS_CLARIFICATION") {
        console.log("Needs clarification for:", result5.step);
    }
    // Resolve selection naturally
    const result6 = await processUserMessage("session-C", "arsenal");
    console.log("Result 6 Status:", result6.status); // Should be SUCCESS
    if (result6.status === "SUCCESS") {
        console.log("Resolved selection:", result6.legs[0]?.selection.label);
    }
    // Test 6: Unknown clarification answer
    console.log("\n--- 6. Unknown clarification answer ---");
    await processUserMessage("session-D", "", selectionAmbiguityIntent); // reset ambiguity
    const result7 = await processUserMessage("session-D", "spurs");
    console.log("Result 7:", JSON.stringify(result7, null, 2));
}
runTest().catch(console.error);
//# sourceMappingURL=testStep6.js.map