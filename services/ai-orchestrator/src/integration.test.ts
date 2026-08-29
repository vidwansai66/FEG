import { describe, it, expect } from "vitest";
import { searchEvents, searchMarkets, resolveSelection, getCurrentOdds } from "./sportsClient.js";

describe("Live Integration Tests against Member 3 (localhost:3000)", () => {
  it("should perform a full end-to-end resolution for an event", async () => {
    // 1. Search for Arsenal
    const events = await searchEvents({ query: "arsenal" });
    expect(events.length).toBeGreaterThan(0);
    const event = events.find((e: any) => e.label.toLowerCase().includes("arsenal"));
    expect(event).toBeDefined();
    expect(event?.eventId).toContain("evt_003_arsenal_manchester_city");

    const eventId = event!.eventId;

    // 2. Search for markets
    const markets = await searchMarkets({ eventId, query: "Match Result" });
    expect(markets.length).toBeGreaterThan(0);
    const market = markets.find((m: any) => m.label.includes("Match Result"));
    expect(market).toBeDefined();

    const marketId = market!.marketId;

    // 3. Resolve selection
    const selectionsResult = await resolveSelection({ eventId, marketId, selectionQuery: "Arsenal" });
    expect(selectionsResult.candidates.length).toBeGreaterThan(0);
    const selection = selectionsResult.candidates.find((s: any) => s.label.toLowerCase().includes("arsenal"));
    expect(selection).toBeDefined();

    const selectionId = selection!.id;

    // 4. Fetch odds
    const odds = await getCurrentOdds({ selectionIds: [selectionId] });
    expect(odds.length).toBe(1);
    expect(odds[0].selectionId).toBe(selectionId);
    expect(typeof odds[0].decimalOdds).toBe("number");
  });
});
