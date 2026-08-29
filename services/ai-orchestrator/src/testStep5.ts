import { processUserIntent } from "./agent.js";
import { UserIntent } from "./schemas.js";

async function runTest() {
  console.log("=== STEP 10 TEST: Full Sports Orchestration ===\n");

  console.log("--- 1. Successful 2-Leg Request ---");
  const successIntent: UserIntent = {
    action: "build_draft_slip",
    stake: 50,
    legs: [
      { eventQuery: "Arsenal vs Chelsea", marketQuery: "Match Result", selectionQuery: "Arsenal" },
      { eventQuery: "Real Madrid vs Barcelona", marketQuery: "Both Teams To Score", selectionQuery: "Yes" }
    ]
  };
  const result1 = await processUserIntent(successIntent);
  console.log(JSON.stringify(result1, null, 2));
  
  console.log("\n--- 2. One Leg Not Found ---");
  const notFoundIntent: UserIntent = {
    action: "build_draft_slip",
    stake: 10,
    legs: [
      { eventQuery: "Arsenal vs Chelsea", marketQuery: "Match Result", selectionQuery: "Arsenal" },
      { eventQuery: "Unknown Event", marketQuery: "Match Result", selectionQuery: "Team X" }
    ]
  };
  const result2 = await processUserIntent(notFoundIntent);
  console.log(JSON.stringify(result2, null, 2));

  console.log("\n--- 3. One Leg Ambiguous (Needs Clarification) ---");
  const ambiguousIntent: UserIntent = {
    action: "build_draft_slip",
    stake: 100,
    legs: [
      { eventQuery: "Manchester", marketQuery: "Match Result", selectionQuery: "Man Utd" },
      { eventQuery: "Real Madrid vs Barcelona", marketQuery: "Both Teams To Score", selectionQuery: "Yes" }
    ]
  };
  const result3 = await processUserIntent(ambiguousIntent);
  console.log(JSON.stringify(result3, null, 2));
}

runTest().catch(console.error);
