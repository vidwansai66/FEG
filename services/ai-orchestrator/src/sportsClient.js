const SPORTS_API_BASE_URL = process.env.SPORTS_API_BASE_URL || "http://localhost:3000";
async function fetchWithTimeout(url, options, timeoutMs = 3000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(id);
        return response;
    }
    catch (error) {
        clearTimeout(id);
        throw error;
    }
}
export const searchEvents = async (input) => {
    const url = `${SPORTS_API_BASE_URL}/api/sports/events?query=${encodeURIComponent(input.query)}`;
    const response = await fetchWithTimeout(url, { method: "GET" });
    if (!response.ok) {
        throw new Error(`Member 3 API Error: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    if (data.status !== "ok" || !Array.isArray(data.candidates)) {
        throw new Error("Malformed response from Member 3 /events API");
    }
    // agent.ts expects array of items with "eventId"
    return data.candidates.map((c) => ({
        ...c,
        eventId: c.id
    }));
};
export const searchMarkets = async (input) => {
    const queryParam = input.query ? `?query=${encodeURIComponent(input.query)}` : "";
    const url = `${SPORTS_API_BASE_URL}/api/sports/events/${encodeURIComponent(input.eventId)}/markets${queryParam}`;
    const response = await fetchWithTimeout(url, { method: "GET" });
    if (!response.ok) {
        throw new Error(`Member 3 API Error: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    if (data.status !== "ok" || !Array.isArray(data.candidates)) {
        throw new Error("Malformed response from Member 3 /markets API");
    }
    // agent.ts expects array of items with "marketId"
    return data.candidates.map((c) => ({
        ...c,
        marketId: c.id
    }));
};
export const resolveSelection = async (input) => {
    // We require eventId in the URL for Member 3
    if (!input.eventId) {
        throw new Error("resolveSelection requires eventId to construct the Member 3 API URL");
    }
    const url = `${SPORTS_API_BASE_URL}/api/sports/events/${encodeURIComponent(input.eventId)}/markets/${encodeURIComponent(input.marketId)}/selections?query=${encodeURIComponent(input.selectionQuery)}`;
    const response = await fetchWithTimeout(url, { method: "GET" });
    if (!response.ok) {
        throw new Error(`Member 3 API Error: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    if (data.status !== "ok" || !Array.isArray(data.candidates)) {
        throw new Error("Malformed response from Member 3 /selections API");
    }
    // agent.ts expects { candidates: [...] }
    return { candidates: data.candidates };
};
export const getCurrentOdds = async (input) => {
    const url = `${SPORTS_API_BASE_URL}/api/sports/odds`;
    const response = await fetchWithTimeout(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ selectionIds: input.selectionIds })
    });
    if (!response.ok) {
        throw new Error(`Member 3 API Error: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    if (data.status !== "ok" || !Array.isArray(data.odds)) {
        throw new Error("Malformed response from Member 3 /odds API");
    }
    // agent.ts expects array of items with "decimalOdds"
    return data.odds;
};
//# sourceMappingURL=sportsClient.js.map