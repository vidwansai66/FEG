import { z } from "zod";
import { SearchEventsTool, SearchMarketsTool, ResolveSelectionTool, GetCurrentOddsTool } from "./tools.js";

// ===========================================================================
// MOCK DATA (Matches Member 3's Football Domain)
// ===========================================================================

// Event 1: Arsenal vs Chelsea (For multi-leg, Leg 1)
const EVT_ARS_CHE = {
  eventId: "evt_1001",
  sport: "football",
  competition: "Premier League",
  homeTeam: "Arsenal",
  awayTeam: "Chelsea",
  startTime: "2026-09-01T15:00:00Z",
  status: "scheduled",
  aliases: ["Arsenal vs Chelsea", "Ars Che"]
};

// Event 2: Real Madrid vs Barcelona (For multi-leg, Leg 2)
const EVT_RMA_BAR = {
  eventId: "evt_1002",
  sport: "football",
  competition: "La Liga",
  homeTeam: "Real Madrid",
  awayTeam: "Barcelona",
  startTime: "2026-09-02T20:00:00Z",
  status: "scheduled",
  aliases: ["El Clasico", "Real Madrid vs Barcelona"]
};

// Event 3 & 4: Ambiguity Example
const EVT_MAN_UTD = {
  eventId: "evt_1003",
  sport: "football",
  competition: "Premier League",
  homeTeam: "Manchester United",
  awayTeam: "Aston Villa",
  startTime: "2026-09-03T17:30:00Z",
  status: "scheduled",
  aliases: ["Man Utd", "Manchester United vs Aston Villa"] 
};

const EVT_MAN_CITY = {
  eventId: "evt_1004",
  sport: "football",
  competition: "Premier League",
  homeTeam: "Manchester City",
  awayTeam: "Newcastle",
  startTime: "2026-09-04T20:00:00Z",
  status: "scheduled",
  aliases: ["Man City", "Manchester City vs Newcastle"] 
};

// Markets
const MKT_ARS_CHE_MATCH = {
  marketId: "mkt_2001",
  eventId: "evt_1001",
  marketType: "MATCH_RESULT",
  name: "Match Result",
  status: "open",
  aliases: ["Match Odds", "1X2", "Moneyline"]
};

const MKT_RMA_BAR_BTTS = {
  marketId: "mkt_2002",
  eventId: "evt_1002",
  marketType: "BOTH_TEAMS_TO_SCORE",
  name: "Both Teams To Score",
  status: "open",
  aliases: ["BTTS"]
};

const MKT_MAN_CITY_MATCH = {
  marketId: "mkt_2005",
  eventId: "evt_1004",
  marketType: "MATCH_RESULT",
  name: "Match Result",
  status: "open",
  aliases: ["Match Odds", "1X2"]
};

// Selections
const SEL_ARS = {
  selectionId: "sel_3001",
  marketId: "mkt_2001",
  name: "Arsenal",
  status: "active",
  aliases: ["Arsenal to win", "Gunners"]
};

const SEL_CHE = {
  selectionId: "sel_3002",
  marketId: "mkt_2001",
  name: "Chelsea",
  status: "active",
  aliases: ["Chelsea to win", "Blues"]
};

const SEL_BTTS_YES = {
  selectionId: "sel_3003",
  marketId: "mkt_2002",
  name: "Yes",
  status: "active",
  aliases: ["Both teams to score yes", "BTTS Yes"]
};

const SEL_MAN_CITY = {
  selectionId: "sel_3004",
  marketId: "mkt_2005",
  name: "Manchester City",
  status: "active",
  aliases: ["Man City to win", "City", "Man City"]
};

// Static Odds
const ODDS = {
  "sel_3001": 2.10, // Arsenal
  "sel_3002": 3.40, // Chelsea
  "sel_3003": 1.65, // BTTS Yes
  "sel_3004": 1.45  // Man City
};


// ===========================================================================
// MOCK IMPLEMENTATIONS (Test tools for Orchestrator Agent)
// ===========================================================================

export const mockSearchEvents = async (input: z.infer<typeof SearchEventsTool.inputSchema>) => {
  const q = input.query.toLowerCase();
  
  if (q.includes("error_event")) throw new Error("Simulated event error");
  if (q.includes("timeout_event")) await new Promise(resolve => setTimeout(resolve, 5000));
  if (q.includes("malformed_event")) return [{ invalid: "data" } as any];
  
  if (q.includes("arsenal") || q.includes("chelsea")) {
    return [EVT_ARS_CHE];
  }

  if (q.includes("real madrid") || q.includes("barcelona") || q.includes("clasico")) {
    return [EVT_RMA_BAR];
  }

  // Ambiguity Example: "Manchester" returns TWO events, requiring further clarification 
  // as it could mean Utd or City.
  if (q.includes("manchester")) {
    return [EVT_MAN_UTD, EVT_MAN_CITY];
  }

  return [];
};

export const mockSearchMarkets = async (input: z.infer<typeof SearchMarketsTool.inputSchema>) => {
  const q = input.query?.toLowerCase() || "";
  if (q.includes("error_market")) throw new Error("Simulated market error");
  if (q.includes("timeout_market")) await new Promise(resolve => setTimeout(resolve, 5000));
  if (q.includes("malformed_market")) return [{ invalid: "data" } as any];

  if (input.eventId === "evt_1001") {
    return [MKT_ARS_CHE_MATCH];
  }
  if (input.eventId === "evt_1002") {
    return [MKT_RMA_BAR_BTTS];
  }
  if (input.eventId === "evt_1003") {
    // Return multiple markets to simulate ambiguity
    return [
      {
        marketId: "mkt_2003",
        eventId: "evt_1003",
        marketType: "MATCH_RESULT",
        name: "Match Result",
        status: "open",
        aliases: ["Match Odds"]
      },
      {
        marketId: "mkt_2004",
        eventId: "evt_1003",
        marketType: "BOTH_TEAMS_TO_SCORE",
        name: "Both Teams To Score",
        status: "open",
        aliases: ["BTTS"]
      }
    ];
  }
  if (input.eventId === "evt_1004") {
    return [MKT_MAN_CITY_MATCH];
  }
  return [];
};

export const mockResolveSelection = async (input: z.infer<typeof ResolveSelectionTool.inputSchema>) => {
  const q = input.selectionQuery.toLowerCase();
  
  if (q.includes("error_selection")) throw new Error("Simulated selection error");
  if (q.includes("timeout_selection")) await new Promise(resolve => setTimeout(resolve, 5000));
  if (q.includes("malformed_selection")) return { invalid: "data" } as any;
  
  if (q.includes("odds_fail")) {
    return { candidates: [{ id: "error_odds", label: "Error Odds", type: "selection", confidence: 1.0, matchReason: "exact" as const, item: {} as any }] };
  }
  if (q.includes("odds_retry")) {
    return { candidates: [{ id: "retry_odds", label: "Retry Odds", type: "selection", confidence: 1.0, matchReason: "exact" as const, item: {} as any }] };
  }

  if (input.marketId === "mkt_2001") {
    // Ambiguity Example: "London" could refer to Arsenal or Chelsea (both London clubs)
    if (q.includes("london")) {
      return {
        candidates: [
          { id: SEL_ARS.selectionId, label: SEL_ARS.name, type: "selection", confidence: 0.5, matchReason: "fuzzy", item: SEL_ARS },
          { id: SEL_CHE.selectionId, label: SEL_CHE.name, type: "selection", confidence: 0.5, matchReason: "fuzzy", item: SEL_CHE }
        ]
      };
    }
    
    if (q.includes("arsenal") || q.includes("gunners")) {
      return { candidates: [{ id: SEL_ARS.selectionId, label: SEL_ARS.name, type: "selection", confidence: 1.0, matchReason: "exact", item: SEL_ARS }] };
    }
    if (q.includes("chelsea") || q.includes("blues")) {
      return { candidates: [{ id: SEL_CHE.selectionId, label: SEL_CHE.name, type: "selection", confidence: 1.0, matchReason: "exact", item: SEL_CHE }] };
    }
  }

  if (input.marketId === "mkt_2002") {
    if (q.includes("yes")) {
      return { candidates: [{ id: SEL_BTTS_YES.selectionId, label: SEL_BTTS_YES.name, type: "selection", confidence: 1.0, matchReason: "exact", item: SEL_BTTS_YES }] };
    }
  }

  if (input.marketId === "mkt_2005") {
    if (q.includes("man city") || q.includes("city")) {
      return { candidates: [{ id: SEL_MAN_CITY.selectionId, label: SEL_MAN_CITY.name, type: "selection", confidence: 1.0, matchReason: "exact", item: SEL_MAN_CITY }] };
    }
  }

  return { candidates: [] };
};

export const mockGetCurrentOdds = async (input: z.infer<typeof GetCurrentOddsTool.inputSchema>) => {
  if (input.selectionIds.includes("error_odds")) throw new Error("Simulated odds error");
  if (input.selectionIds.includes("timeout_odds")) await new Promise(resolve => setTimeout(resolve, 5000));
  if (input.selectionIds.includes("malformed_odds")) return [{ invalid: "data" } as any];

  let requestCount = 0; // Simulate success after retry
  if (input.selectionIds.includes("retry_odds")) {
    const glob = globalThis as any;
    if (!glob.retryCount) glob.retryCount = 0;
    glob.retryCount++;
    if (glob.retryCount < 2) throw new Error("Simulated temporary error");
  }

  const now = new Date().toISOString();
  return input.selectionIds.map(id => {
    if (id === "retry_odds") {
      return { selectionId: id, decimalOdds: 2.5, timestamp: now, source: "mock" };
    }
    const odds = ODDS[id as keyof typeof ODDS];
    if (odds === undefined) {
      throw new Error(`Unknown selectionId: ${id}`);
    }
    return {
      selectionId: id,
      decimalOdds: odds,
      timestamp: now,
      source: "mock"
    };
  });
};
