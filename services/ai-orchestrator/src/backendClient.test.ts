import { describe, it, expect, vi, beforeEach } from "vitest";
import { createDraftSlip, updateDraftSlip, validateDraftSlip, getSlip, BACKEND_URL } from "./backendClient.js";

// Setup global fetch mock
global.fetch = vi.fn();

describe("backendClient", () => {
  beforeEach(() => {
    vi.mocked(global.fetch).mockClear();
  });

  const mockPayload = {
    stake: 100,
    legs: [
      {
        eventId: "evt_1",
        marketId: "mkt_1",
        selectionId: "sel_1",
        acceptedOdds: 2.5,
        oddsTimestamp: new Date().toISOString(),
        eventLabel: "Event 1",
        marketLabel: "Market 1",
        selectionLabel: "Selection 1"
      }
    ]
  };

  it("should create a draft slip successfully", async () => {
    const mockResponse = { id: "slip_123", status: "DRAFT" };
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockResponse })
    } as any);

    const result = await createDraftSlip(mockPayload);
    expect(global.fetch).toHaveBeenCalledWith(`${BACKEND_URL}/api/slips`, expect.objectContaining({
      method: "POST",
      body: JSON.stringify(mockPayload)
    }));
    expect(result).toEqual(mockResponse);
  });

  it("should handle create draft slip failure", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: { message: "Bad Request" } })
    } as any);

    await expect(createDraftSlip(mockPayload)).rejects.toThrow("Member 4 API Error: 400 - {\"message\":\"Bad Request\"}");
  });

  it("should update a draft slip successfully", async () => {
    const updatePayload = { stake: 200 };
    const mockResponse = { id: "slip_123", status: "DRAFT", stake: 200 };
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockResponse })
    } as any);

    const result = await updateDraftSlip("slip_123", updatePayload);
    expect(global.fetch).toHaveBeenCalledWith(`${BACKEND_URL}/api/slips/slip_123`, expect.objectContaining({
      method: "PATCH",
      body: JSON.stringify(updatePayload)
    }));
    expect(result).toEqual(mockResponse);
  });

  it("should validate a draft slip successfully", async () => {
    const mockResponse = { slipId: "slip_123", status: "VALIDATED", totalOdds: 2.5, issues: [] };
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockResponse })
    } as any);

    const result = await validateDraftSlip("slip_123");
    expect(global.fetch).toHaveBeenCalledWith(`${BACKEND_URL}/api/slips/validate`, expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ slipId: "slip_123" })
    }));
    expect(result.ok).toBe(true);
    expect(result.data).toEqual(mockResponse);
  });

  it("should return raw errors for validateDraftSlip failure", async () => {
    const errorResponse = { code: "ODDS_CHANGED", message: "Odds changed" };
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({ error: errorResponse })
    } as any);

    const result = await validateDraftSlip("slip_123");
    expect(result.ok).toBe(false);
    expect(result.status).toBe(409);
    expect(result.error).toEqual(errorResponse);
  });

  it("should get a slip successfully", async () => {
    const mockResponse = { id: "slip_123", status: "DRAFT" };
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockResponse })
    } as any);

    const result = await getSlip("slip_123");
    expect(global.fetch).toHaveBeenCalledWith(`${BACKEND_URL}/api/slips/slip_123`, expect.objectContaining({
      method: "GET"
    }));
    expect(result).toEqual(mockResponse);
  });
});
