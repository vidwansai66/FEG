export const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:4000";

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number = 3000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

export type BackendSlipLeg = {
  eventId: string;
  marketId: string;
  selectionId: string;
  acceptedOdds: number;
  oddsTimestamp: string;
  eventLabel: string;
  marketLabel: string;
  selectionLabel: string;
};

export type CreateSlipPayload = {
  sessionId?: string;
  stake: number;
  legs: BackendSlipLeg[];
};

export type UpdateSlipPayload = Partial<CreateSlipPayload>;

export async function createDraftSlip(payload: CreateSlipPayload) {
  const response = await fetchWithTimeout(`${BACKEND_URL}/api/slips`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Member 4 API Error: ${response.status} - ${JSON.stringify(data.error)}`);
  }
  return data.data; // { id: "...", ... }
}

export async function getSlip(slipId: string) {
  const response = await fetchWithTimeout(`${BACKEND_URL}/api/slips/${slipId}`, {
    method: "GET"
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Member 4 API Error: ${response.status} - ${JSON.stringify(data.error)}`);
  }
  return data.data;
}

export async function updateDraftSlip(slipId: string, payload: UpdateSlipPayload) {
  const response = await fetchWithTimeout(`${BACKEND_URL}/api/slips/${slipId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Member 4 API Error: ${response.status} - ${JSON.stringify(data.error)}`);
  }
  return data.data;
}

export async function validateDraftSlip(slipId: string) {
  const response = await fetchWithTimeout(`${BACKEND_URL}/api/slips/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slipId })
  });

  const data = await response.json();
  // We must return the raw response including errors so the agent can parse issues
  if (!response.ok) {
    return { ok: false, status: response.status, error: data.error };
  }
  return { ok: true, data: data.data };
}
