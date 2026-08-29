import { processUserMessage, processEditIntent } from "./agent.js";
import { UserIntent } from "./schemas.js";

async function runTest() {
  console.log("=== STEP 12 TEST: Edit Command Handling ===\n");
  
  const sessionId = "edit-session";

  const initialIntent: UserIntent = {
    action: "build_draft_slip",
    stake: 50,
    legs: [
      { eventQuery: "Arsenal vs Chelsea", marketQuery: "Match Result", selectionQuery: "Arsenal" },
      { eventQuery: "Real Madrid vs Barcelona", marketQuery: "Both Teams To Score", selectionQuery: "Yes" },
      { eventQuery: "Chelsea", marketQuery: "Match Result", selectionQuery: "Chelsea" }
    ]
  };

  // 1. Establish the session
  const result1 = await processUserMessage(sessionId, "", initialIntent);
  console.log("Initial Setup Status:", result1.status);
  
  // Test 1: Change stake
  console.log("\n--- 1. Change stake to 200 ---");
  const edit1 = await processEditIntent(sessionId, { action: "edit_stake", stake: 200 });
  if ("stake" in edit1) {
    console.log("New Stake:", edit1.stake);
  }

  // Test 2: Remove leg 2
  console.log("\n--- 2. Remove leg 2 (Real Madrid) ---");
  const edit2 = await processEditIntent(sessionId, { action: "remove_leg", legIndex: 2 });
  if ("legs" in edit2) {
    console.log("Remaining Legs Count:", edit2.legs.length);
    console.log("Remaining Leg 2 (index 1):", edit2.legs[1]?.event.homeTeam);
  }

  // Test 3: Remove named selection
  console.log("\n--- 3. Remove 'Chelsea' ---");
  const edit3 = await processEditIntent(sessionId, { action: "remove_leg", targetQuery: "Chelsea" });
  if ("legs" in edit3) {
    console.log("Remaining Legs Count:", edit3.legs.length);
    console.log("Remaining Leg 1:", edit3.legs[0]?.event.homeTeam);
  }

  // Test 4: Change selection
  console.log("\n--- 4. Change Arsenal to Chelsea ---");
  const edit4 = await processEditIntent(sessionId, { action: "change_selection", legIndex: 1, newSelectionQuery: "Chelsea" });
  if ("legs" in edit4) {
    console.log("Leg 1 Selection:", edit4.legs[0]?.selection.label);
    console.log("Updated Odds:", edit4.odds[0]?.decimalOdds); // 3.4 for Chelsea
  }

  // Test 5: Invalid edit
  console.log("\n--- 5. Invalid edit (remove leg 99) ---");
  const edit5 = await processEditIntent(sessionId, { action: "remove_leg", legIndex: 99 });
  console.log("Result:", JSON.stringify(edit5, null, 2));

  // Test 6: Edit without active session
  console.log("\n--- 6. Edit with no active session ---");
  const edit6 = await processEditIntent("empty-session", { action: "edit_stake", stake: 100 });
  console.log("Result:", JSON.stringify(edit6, null, 2));
}

runTest().catch(console.error);
