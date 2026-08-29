import { describe, it, expect, vi, beforeEach } from "vitest";
import { searchEvents, searchMarkets, resolveSelection, getCurrentOdds } from "./sportsClient.js";

// Mock global fetch
const fetchMock = vi.fn();
global.fetch = fetchMock;

describe("sportsClient", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("searchEvents calls correct URL and formats response", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: "ok",
        candidates: [{ id: "evt_123", label: "Event 123", type: "event" }]
      })
    } as Response);

    const result = await searchEvents({ query: "arsenal" });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/sports/events?query=arsenal"),
      expect.any(Object)
    );
    expect(result).toEqual([{ id: "evt_123", label: "Event 123", type: "event", eventId: "evt_123" }]);
  });

  it("searchMarkets calls correct URL and formats response", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: "ok",
        candidates: [{ id: "mkt_123", label: "Match Result", type: "market" }]
      })
    } as Response);

    const result = await searchMarkets({ eventId: "evt_123", query: "match" });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/sports/events/evt_123/markets?query=match"),
      expect.any(Object)
    );
    expect(result).toEqual([{ id: "mkt_123", label: "Match Result", type: "market", marketId: "mkt_123" }]);
  });

  it("resolveSelection calls correct URL", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: "ok",
        candidates: [{ id: "sel_123", label: "Arsenal", type: "selection" }]
      })
    } as Response);

    const result = await resolveSelection({ eventId: "evt_123", marketId: "mkt_123", selectionQuery: "arsenal" });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/sports/events/evt_123/markets/mkt_123/selections?query=arsenal"),
      expect.any(Object)
    );
    expect(result.candidates).toEqual([{ id: "sel_123", label: "Arsenal", type: "selection" }]);
  });

  it("getCurrentOdds calls correct URL and returns odds", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: "ok",
        odds: [{ selectionId: "sel_123", decimalOdds: 2.1 }]
      })
    } as Response);

    const result = await getCurrentOdds({ selectionIds: ["sel_123"] });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/sports/odds"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ selectionIds: ["sel_123"] })
      })
    );
    expect(result).toEqual([{ selectionId: "sel_123", decimalOdds: 2.1 }]);
  });
});
