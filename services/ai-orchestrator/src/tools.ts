import { z } from 'zod';

// ---------------------------------------------------------------------------
// AI Tool Definitions (Adapters for the Orchestrator)
// ---------------------------------------------------------------------------
// Note: These define the conceptual AI tools required by Member 1. 
// The AI orchestrator will translate calls to these conceptual tools 
// into calls to the actual Member 3 API (e.g. /api/sports/resolve and /api/sports/odds).
// We do not invent simplified interfaces or assume 1:1 HTTP endpoint mappings here.

export const SearchEventsTool = {
  name: "search_events",
  description: "Search for authoritative sports events based on a user's natural language query. Always use this to get the canonical eventId.",
  inputSchema: z.object({
    query: z.string().describe("The user's query for the event (e.g., 'Arsenal vs Chelsea', 'Lakers').")
  }).strict()
  // Maps to: GET /api/sports/events
  // Contract: Query string `?query=...` returning Member 3 `Event[]`
};

export const SearchMarketsTool = {
  name: "search_markets",
  description: "Search for betting markets within a specific event. Requires a valid eventId obtained from search_events.",
  inputSchema: z.object({
    eventId: z.string().describe("The authoritative eventId obtained from search_events."),
    query: z.string().optional().describe("An optional query to filter markets (e.g., 'Match Odds', 'Over/Under').")
  }).strict()
  // Maps to: GET /api/sports/events/[eventId]/markets
  // Contract: Path param `eventId` and optional query string `?query=...` returning Member 3 `Market[]`
};

export const ResolveSelectionTool = {
  name: "resolve_selection",
  description: "Resolve a user's selection query (e.g., 'Arsenal to win') to an authoritative selectionId within a specific market.",
  inputSchema: z.object({
    marketId: z.string().describe("The authoritative marketId obtained from search_markets."),
    selectionQuery: z.string().describe("The user's description of their pick (e.g., 'Arsenal', 'Over 2.5').")
  }).strict()
  // Maps to: POST /api/sports/resolve
  // Contract: Payload matches `resolveBetRequestSchema` (e.g. { marketId: "...", selectionQuery: "..." }) returning resolution result with Selection candidates.
};

export const GetCurrentOddsTool = {
  name: "get_current_odds",
  description: "Fetch the latest authoritative odds for a batch of resolved selections.",
  inputSchema: z.object({
    selectionIds: z.array(z.string()).min(1).max(20).describe("An array of 1 to 20 authoritative selectionIds obtained from resolve_selection.")
  }).strict()
  // Maps to: POST /api/sports/odds
  // Contract: Payload matches `oddsRequestSchema` ({ selectionIds: string[] }) returning Member 3 `OddsSnapshot[]`
};

