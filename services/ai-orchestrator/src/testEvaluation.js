import { processUserMessage, processEditIntent } from "./agent.js";
async function runEval() {
    console.log("=== STEP 14 TEST: Evaluation Suite ===\n");
    let passed = 0;
    let failed = 0;
    let bugs = [];
    function assertState(name, actual, expected) {
        if (actual === expected) {
            console.log(`✅ [PASS] ${name} (State: ${actual})`);
            passed++;
        }
        else {
            console.log(`❌ [FAIL] ${name} (Expected: ${expected}, Got: ${actual})`);
            failed++;
            bugs.push(`${name} failed. Expected ${expected}, Got ${actual}`);
        }
    }
    const sid = "eval-session";
    // 1. Perfect 3-leg request
    const req1 = {
        action: "build_draft_slip",
        legs: [
            { eventQuery: "Arsenal vs Chelsea", marketQuery: "Match Result", selectionQuery: "Arsenal" },
            { eventQuery: "Real Madrid vs Barcelona", marketQuery: "Both Teams To Score", selectionQuery: "Yes" },
            { eventQuery: "Chelsea", marketQuery: "Match Result", selectionQuery: "Chelsea" }
        ]
    };
    const res1 = await processUserMessage(sid, "", req1);
    assertState("1. Perfect 3-leg request", res1.status, "SUCCESS");
    // 2. Misspelled team name
    const req2 = { action: "build_draft_slip", legs: [{ eventQuery: "Arzenal", marketQuery: "Match Result", selectionQuery: "Arsenal" }] };
    const res2 = await processUserMessage("sid-2", "", req2);
    assertState("2. Misspelled team name", res2.status, "NOT_FOUND");
    // 3. Misspelled player/selection
    const req3 = { action: "build_draft_slip", legs: [{ eventQuery: "Arsenal", marketQuery: "Match Result", selectionQuery: "Chelski" }] };
    const res3 = await processUserMessage("sid-3", "", req3);
    assertState("3. Misspelled player/selection", res3.status, "NOT_FOUND");
    // 4. Two matching events
    const req4 = { action: "build_draft_slip", legs: [{ eventQuery: "Manchester", marketQuery: "Match Result", selectionQuery: "Man City" }] };
    const res4 = await processUserMessage("sid-4", "", req4);
    assertState("4. Two matching events", res4.status, "NEEDS_CLARIFICATION");
    // 5. Unknown player/selection
    const req5 = { action: "build_draft_slip", legs: [{ eventQuery: "Arsenal", marketQuery: "Match Result", selectionQuery: "Saka" }] };
    const res5 = await processUserMessage("sid-5", "", req5);
    assertState("5. Unknown player/selection", res5.status, "NOT_FOUND");
    // 6. Unavailable market
    const req6 = { action: "build_draft_slip", legs: [{ eventQuery: "Real Madrid", marketQuery: "Over 2.5 goals", selectionQuery: "Over 2.5" }] };
    const res6 = await processUserMessage("sid-6", "", req6);
    assertState("6. Unavailable market", res6.status, "NOT_FOUND");
    // 7. Changed stake
    const res7 = await processEditIntent(sid, { action: "edit_stake", stake: 100 });
    assertState("7. Changed stake", res7.status, "SUCCESS");
    // 8. Remove a leg
    const res8 = await processEditIntent(sid, { action: "remove_leg", targetQuery: "Real Madrid" });
    assertState("8. Remove a leg", res8.status, "SUCCESS");
    // 9. Replace/change selection
    const res9 = await processEditIntent(sid, { action: "change_selection", targetQuery: "Arsenal", newSelectionQuery: "Chelsea" });
    assertState("9. Replace/change selection", res9.status, "SUCCESS");
    // 10. User says "confirm"
    // Since "confirm" is not a valid action in our schema, if the LLM outputted it, it would fail Zod validation.
    // If the LLM outputted "build_draft_slip" again, it wouldn't confirm anything because Member 1 doesn't have a confirm tool.
    // We will simulate that processing a standard intent never results in a confirmed bet (no CONFIRMED status).
    const req10 = { action: "build_draft_slip", legs: [{ eventQuery: "Arsenal", marketQuery: "Match Result", selectionQuery: "Arsenal" }] };
    const res10 = await processUserMessage("sid-10", "", req10);
    assertState("10. User says 'confirm' (Safety: cannot place bet)", res10.status === "SUCCESS" ? "SUCCESS_NOT_CONFIRMED" : "FAIL", "SUCCESS_NOT_CONFIRMED");
    // 11. Tool timeout
    const req11 = { action: "build_draft_slip", legs: [{ eventQuery: "timeout_event", marketQuery: "Match Result", selectionQuery: "Arsenal" }] };
    const res11 = await processUserMessage("sid-11", "", req11);
    assertState("11. Tool timeout", res11.status, "TOOL_ERROR");
    // 12. Tool failure
    const req12 = { action: "build_draft_slip", legs: [{ eventQuery: "Arsenal", marketQuery: "error_market", selectionQuery: "Arsenal" }] };
    const res12 = await processUserMessage("sid-12", "", req12);
    assertState("12. Tool failure", res12.status, "TOOL_ERROR");
    // 13. Ambiguous selection
    const req13 = { action: "build_draft_slip", legs: [{ eventQuery: "Arsenal", marketQuery: "Match Result", selectionQuery: "London" }] };
    const res13 = await processUserMessage("sid-13", "", req13);
    assertState("13. Ambiguous selection", res13.status, "NEEDS_CLARIFICATION");
    // 14. Clarification response
    const res14 = await processUserMessage("sid-13", "arsenal");
    assertState("14. Clarification response", res14.status, "SUCCESS");
    // 15. Follow-up command using existing session context
    // The LLM would output an edit intent or a new user intent. Here we'll simulate an edit target query that matches.
    const res15 = await processEditIntent(sid, { action: "remove_leg", legIndex: 1 }); // removing the only leg left (Chelsea) from our eval session
    // Wait, `sid` had 3 legs. We removed Real Madrid (now 2 legs). We changed Arsenal to Chelsea (now 2 legs).
    // If we remove legIndex 1, we expect SUCCESS.
    assertState("15. Follow-up command using existing session", res15.status, "SUCCESS");
    console.log("\n=================================");
    console.log(`Passed: ${passed}/${15}`);
    console.log(`Failed: ${failed}/${15}`);
    if (failed > 0) {
        console.log("Bugs Found:\n", bugs.join("\n"));
    }
    console.log("=================================\n");
}
runEval().catch(console.error);
//# sourceMappingURL=testEvaluation.js.map