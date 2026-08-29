import { UserIntentSchema } from './schemas.js';
import { SYSTEM_PROMPT_INTENT_EXTRACTION } from './prompts.js';
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
/**
 * Extracts a structured UserIntent from a natural language query using OpenRouter.
 * @param userInput The natural language query (e.g., "50 bucks on Arsenal and BTTS in the Madrid game")
 * @returns A validated UserIntent object conforming strictly to UserIntentSchema
 */
export async function extractUserIntent(userInput) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
        throw new Error("OPENROUTER_API_KEY environment variable is missing.");
    }
    // Default to the NVIDIA free model as required
    const model = process.env.OPENROUTER_MODEL || "nvidia/nemotron-3-super-120b-a12b:free";
    const payload = {
        model: model,
        messages: [
            { role: "system", content: SYSTEM_PROMPT_INTENT_EXTRACTION },
            { role: "user", content: userInput }
        ],
        // Suggest to OpenRouter to return JSON, though we parse defensively below
        response_format: { type: "json_object" }
    };
    const response = await fetch(OPENROUTER_API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify(payload)
    });
    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`OpenRouter API Error: ${response.status} - ${errorBody}`);
    }
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
        throw new Error("Received empty response from OpenRouter model.");
    }
    try {
        // Defensively parse JSON in case the model wraps it in markdown code blocks
        const cleanedContent = content.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsedJson = JSON.parse(cleanedContent);
        // Validate strictly against the UserIntentSchema
        const validation = UserIntentSchema.safeParse(parsedJson);
        if (!validation.success) {
            throw new Error(`Schema validation failed: ${JSON.stringify(validation.error.issues)}`);
        }
        return validation.data;
    }
    catch (err) {
        throw new Error(`Failed to parse or validate LLM output: ${err.message}. Raw output: ${content}`);
    }
}
// ===========================================================================
// ORCHESTRATION: STEP 1 (EVENT RESOLUTION)
// ===========================================================================
import { mockSearchEvents, mockSearchMarkets, mockResolveSelection, mockGetCurrentOdds } from "./mockTools.js"; // Using .js for ES Module resolution
import { getSession, setPendingClarification, clearPendingClarification, setActiveIntent } from "./session.js";
async function executeTool(operationName, operation, validator, options = {}) {
    const maxRetries = options.maxRetries ?? 1;
    const timeoutMs = options.timeoutMs ?? 1000;
    let attempt = 0;
    while (attempt <= maxRetries) {
        try {
            const result = await Promise.race([
                operation(),
                new Promise((_, reject) => {
                    setTimeout(() => reject(new Error("TOOL_TIMEOUT")), timeoutMs);
                })
            ]);
            if (!validator(result)) {
                throw new Error("MALFORMED_RESULT");
            }
            return result;
        }
        catch (error) {
            const isTimeout = error instanceof Error && error.message === "TOOL_TIMEOUT";
            const isMalformed = error instanceof Error && error.message === "MALFORMED_RESULT";
            if (attempt === maxRetries) {
                if (isTimeout)
                    throw new Error(`[${operationName}] Timeout after ${maxRetries} retries`);
                if (isMalformed)
                    throw new Error(`[${operationName}] Malformed response`);
                throw new Error(`[${operationName}] Failed: ${error instanceof Error ? error.message : String(error)}`);
            }
            attempt++;
        }
    }
    throw new Error("Unreachable");
}
/**
 * Executes the first orchestration step: resolving an eventQuery to a verified eventId.
 */
export async function resolveEventIntent(query) {
    let events;
    try {
        events = await executeTool("search_events", () => mockSearchEvents({ query }), (res) => Array.isArray(res) && (res.length === 0 || "eventId" in res[0]), { timeoutMs: 1000, maxRetries: 1 });
    }
    catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        return { status: "TOOL_ERROR", message: errorMsg, isTimeout: errorMsg.includes("Timeout") };
    }
    if (events.length === 0) {
        return {
            status: "NOT_FOUND",
            message: `No events found matching "${query}". Please verify the event details.`
        };
    }
    if (events.length === 1) {
        return {
            status: "SUCCESS",
            event: events[0]
        };
    }
    // If multiple events match (e.g., "Manchester"), it requires targeted clarification
    return {
        status: "NEEDS_CLARIFICATION",
        candidates: events
    };
}
/**
 * Executes the second orchestration step: resolving a marketQuery given a verified eventId.
 */
export async function resolveMarketIntent(eventId, marketQuery) {
    let markets;
    try {
        markets = await executeTool("search_markets", () => mockSearchMarkets({ eventId, query: marketQuery }), (res) => Array.isArray(res) && (res.length === 0 || "marketId" in res[0]), { timeoutMs: 1000, maxRetries: 1 });
    }
    catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        return { status: "TOOL_ERROR", message: errorMsg, isTimeout: errorMsg.includes("Timeout") };
    }
    if (markets.length === 0) {
        return {
            status: "NOT_FOUND",
            message: `No markets found matching "${marketQuery}" for event ${eventId}.`
        };
    }
    if (markets.length === 1) {
        return {
            status: "SUCCESS",
            market: markets[0]
        };
    }
    return {
        status: "NEEDS_CLARIFICATION",
        candidates: markets
    };
}
/**
 * Executes the third orchestration step: resolving a selectionQuery given verified eventId and marketId.
 */
export async function resolveSelectionIntent(eventId, marketId, selectionQuery) {
    let result;
    try {
        result = await executeTool("resolve_selection", () => mockResolveSelection({ marketId, selectionQuery }), (res) => typeof res === "object" && res !== null && Array.isArray(res.candidates), { timeoutMs: 1000, maxRetries: 1 });
    }
    catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        return { status: "TOOL_ERROR", message: errorMsg, isTimeout: errorMsg.includes("Timeout") };
    }
    const candidates = result.candidates;
    if (candidates.length === 0) {
        return {
            status: "NOT_FOUND",
            message: `No selections found matching "${selectionQuery}" for market ${marketId}.`
        };
    }
    if (candidates.length === 1) {
        return {
            status: "SUCCESS",
            selection: candidates[0]
        };
    }
    return {
        status: "NEEDS_CLARIFICATION",
        candidates
    };
}
/**
 * Executes the fourth orchestration step: fetching current odds for verified selection(s).
 */
export async function resolveOddsIntent(selectionIds) {
    if (selectionIds.length === 0) {
        return {
            status: "NOT_FOUND",
            message: "No selection IDs provided to fetch odds."
        };
    }
    try {
        const oddsResult = await executeTool("get_current_odds", () => mockGetCurrentOdds({ selectionIds }), (res) => Array.isArray(res) && (res.length === 0 || "decimalOdds" in res[0]), { timeoutMs: 1000, maxRetries: 1 });
        return {
            status: "SUCCESS",
            odds: oddsResult
        };
    }
    catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        if (errorMsg.includes("Unknown selectionId")) {
            return { status: "NOT_FOUND", message: errorMsg };
        }
        return { status: "TOOL_ERROR", message: errorMsg, isTimeout: errorMsg.includes("Timeout") };
    }
}
/**
 * Executes the full sports orchestration workflow for a structured UserIntent.
 */
export async function processUserIntent(intent, cachedLegs = []) {
    const processedLegs = [];
    const selectionIds = [];
    for (let i = 0; i < intent.legs.length; i++) {
        const leg = intent.legs[i];
        const cached = cachedLegs[i] || {};
        // 1. Resolve Event
        let eventResultEvent = cached.event;
        if (!eventResultEvent) {
            const eventResult = await resolveEventIntent(leg.eventQuery);
            if (eventResult.status === "TOOL_ERROR") {
                return { status: "TOOL_ERROR", legIndex: i, step: "event", message: eventResult.message, isTimeout: eventResult.isTimeout };
            }
            if (eventResult.status === "NOT_FOUND") {
                return { status: "NOT_FOUND", legIndex: i, step: "event", message: eventResult.message };
            }
            if (eventResult.status === "NEEDS_CLARIFICATION") {
                return { status: "NEEDS_CLARIFICATION", legIndex: i, step: "event", candidates: eventResult.candidates, cachedLegs: processedLegs };
            }
            eventResultEvent = eventResult.event;
        }
        // 2. Resolve Market
        let marketResultMarket = cached.market;
        if (!marketResultMarket) {
            const marketResult = await resolveMarketIntent(eventResultEvent.eventId, leg.marketQuery);
            if (marketResult.status === "TOOL_ERROR") {
                return { status: "TOOL_ERROR", legIndex: i, step: "market", message: marketResult.message, isTimeout: marketResult.isTimeout };
            }
            if (marketResult.status === "NOT_FOUND") {
                return { status: "NOT_FOUND", legIndex: i, step: "market", message: marketResult.message };
            }
            if (marketResult.status === "NEEDS_CLARIFICATION") {
                const partialLegs = [...processedLegs, { event: eventResultEvent }];
                return { status: "NEEDS_CLARIFICATION", legIndex: i, step: "market", candidates: marketResult.candidates, cachedLegs: partialLegs };
            }
            marketResultMarket = marketResult.market;
        }
        // 3. Resolve Selection
        let selectionResultSelection = cached.selection;
        if (!selectionResultSelection) {
            const selectionResult = await resolveSelectionIntent(eventResultEvent.eventId, marketResultMarket.marketId, leg.selectionQuery);
            if (selectionResult.status === "TOOL_ERROR") {
                return { status: "TOOL_ERROR", legIndex: i, step: "selection", message: selectionResult.message, isTimeout: selectionResult.isTimeout };
            }
            if (selectionResult.status === "NOT_FOUND") {
                return { status: "NOT_FOUND", legIndex: i, step: "selection", message: selectionResult.message };
            }
            if (selectionResult.status === "NEEDS_CLARIFICATION") {
                const partialLegs = [...processedLegs, { event: eventResultEvent, market: marketResultMarket }];
                return { status: "NEEDS_CLARIFICATION", legIndex: i, step: "selection", candidates: selectionResult.candidates, cachedLegs: partialLegs };
            }
            selectionResultSelection = selectionResult.selection;
        }
        // Collect resolved item
        const fullLeg = {
            legIndex: i,
            event: eventResultEvent,
            market: marketResultMarket,
            selection: selectionResultSelection
        };
        processedLegs.push(fullLeg);
        selectionIds.push(fullLeg.selection.id);
    }
    // 4. Resolve Odds (only once all legs succeed)
    const oddsResult = await resolveOddsIntent(selectionIds);
    if (oddsResult.status === "TOOL_ERROR") {
        return { status: "TOOL_ERROR", step: "odds", message: oddsResult.message, isTimeout: oddsResult.isTimeout };
    }
    if (oddsResult.status === "NOT_FOUND") {
        return { status: "ODDS_FAILED", message: oddsResult.message };
    }
    // 5. Final Success
    return {
        status: "SUCCESS",
        ...(intent.stake !== undefined ? { stake: intent.stake } : {}),
        legs: processedLegs,
        odds: oddsResult.odds
    };
}
/**
 * Entry point for user messages: resolves pending clarifications or processes a new intent.
 */
export async function processUserMessage(sessionId, message, intent) {
    const session = getSession(sessionId);
    if (session.pendingClarification) {
        const { candidates, originalIntent, cachedLegs, legIndex, step } = session.pendingClarification;
        let selected;
        const indexMatch = message.match(/^\s*(\d+)\s*$/);
        if (indexMatch) {
            const idx = parseInt(indexMatch[1], 10) - 1;
            if (idx >= 0 && idx < candidates.length) {
                selected = candidates[idx];
            }
            else {
                return { status: "CLARIFICATION_ERROR", message: `Invalid selection number. Please choose between 1 and ${candidates.length}.` };
            }
        }
        else {
            const normalizedAnswer = message.toLowerCase();
            for (const candidate of candidates) {
                let namesToMatch = [];
                if ("homeTeam" in candidate) {
                    namesToMatch = [candidate.homeTeam, candidate.awayTeam, ...(candidate.aliases || [])];
                }
                else if ("marketType" in candidate) {
                    namesToMatch = [candidate.name, ...(candidate.aliases || [])];
                }
                else if ("label" in candidate) {
                    namesToMatch = [candidate.label, ...(candidate.item?.aliases || [])];
                }
                if (namesToMatch.some(n => n.toLowerCase().includes(normalizedAnswer))) {
                    selected = candidate;
                    break;
                }
            }
        }
        if (!selected) {
            return { status: "CLARIFICATION_ERROR", message: "Your answer did not match any of the provided candidates." };
        }
        // Pad cached legs if needed
        while (cachedLegs.length <= legIndex) {
            cachedLegs.push({});
        }
        const currentLeg = cachedLegs[legIndex];
        if (step === "event")
            currentLeg.event = selected;
        else if (step === "market")
            currentLeg.market = selected;
        else if (step === "selection")
            currentLeg.selection = selected;
        clearPendingClarification(sessionId);
        // Resume orchestration
        const result = await processUserIntent(originalIntent, cachedLegs);
        if (result.status === "NEEDS_CLARIFICATION") {
            setPendingClarification(sessionId, {
                originalIntent,
                legIndex: result.legIndex,
                step: result.step,
                candidates: result.candidates,
                cachedLegs: result.cachedLegs
            });
        }
        else if (result.status === "SUCCESS") {
            setActiveIntent(sessionId, originalIntent, result.legs, result);
        }
        return result;
    }
    // New intent processing
    if (!intent) {
        throw new Error("No pending clarification and no new UserIntent provided.");
    }
    clearPendingClarification(sessionId);
    const result = await processUserIntent(intent);
    if (result.status === "NEEDS_CLARIFICATION") {
        setPendingClarification(sessionId, {
            originalIntent: intent,
            legIndex: result.legIndex,
            step: result.step,
            candidates: result.candidates,
            cachedLegs: result.cachedLegs
        });
    }
    else if (result.status === "SUCCESS") {
        setActiveIntent(sessionId, intent, result.legs, result);
    }
    return result;
}
export async function processConfirmIntent(sessionId) {
    const session = getSession(sessionId);
    if (!session.activeIntent || !session.activeLegs || !session.lastResult || session.lastResult.status !== "SUCCESS") {
        return { status: "EDIT_ERROR", message: "No active bet slip to confirm." };
    }
    // Safety Boundary: We do NOT submit to the backend. We strictly return CONFIRMATION_REQUIRED 
    // with the finalized structured data so the frontend can display the physical "Place Bet" button.
    return {
        status: "CONFIRMATION_REQUIRED",
        draft: {
            stake: session.lastResult.stake,
            legs: session.lastResult.legs,
            odds: session.lastResult.odds
        }
    };
}
/**
 * Applies an EditIntent to the currently active session state.
 */
export async function processEditIntent(sessionId, edit) {
    const session = getSession(sessionId);
    if (!session.activeIntent || !session.activeLegs || !session.lastResult || session.lastResult.status !== "SUCCESS") {
        return { status: "EDIT_ERROR", message: "No active bet slip to edit." };
    }
    // Clone deeply to avoid mutating state before success
    const newIntent = JSON.parse(JSON.stringify(session.activeIntent));
    const newCachedLegs = [...session.activeLegs];
    if (edit.action === "edit_stake") {
        newIntent.stake = edit.stake;
        const patchedResult = { ...session.lastResult, stake: edit.stake };
        setActiveIntent(sessionId, newIntent, newCachedLegs, patchedResult);
        return patchedResult;
    }
    if (edit.action === "remove_leg") {
        let indexToRemove = -1;
        if (edit.legIndex !== undefined) {
            indexToRemove = edit.legIndex - 1; // 1-based to 0-based
        }
        else if (edit.targetQuery) {
            indexToRemove = findLegIndex(newCachedLegs, edit.targetQuery);
        }
        if (indexToRemove < 0 || indexToRemove >= newIntent.legs.length) {
            return { status: "EDIT_ERROR", message: "Could not identify which leg to remove." };
        }
        newIntent.legs.splice(indexToRemove, 1);
        newCachedLegs.splice(indexToRemove, 1);
        if (newIntent.legs.length === 0) {
            return { status: "EDIT_ERROR", message: "Cannot remove the last leg of a bet slip." };
        }
        // Re-run to strictly resolve odds for remaining
        const result = await processUserIntent(newIntent, newCachedLegs);
        if (result.status === "SUCCESS") {
            setActiveIntent(sessionId, newIntent, result.legs, result);
        }
        return result;
    }
    if (edit.action === "change_selection") {
        let indexToChange = -1;
        if (edit.legIndex !== undefined) {
            indexToChange = edit.legIndex - 1;
        }
        else if (edit.targetQuery) {
            indexToChange = findLegIndex(newCachedLegs, edit.targetQuery);
        }
        if (indexToChange < 0 || indexToChange >= newIntent.legs.length) {
            return { status: "EDIT_ERROR", message: "Could not identify which leg to change." };
        }
        newIntent.legs[indexToChange].selectionQuery = edit.newSelectionQuery;
        // Invalidate the selection part of the cache for this leg
        const legCache = newCachedLegs[indexToChange];
        newCachedLegs[indexToChange] = {
            ...(legCache.event ? { event: legCache.event } : {}),
            ...(legCache.market ? { market: legCache.market } : {})
            // selection intentionally omitted to force re-resolution
        };
        const result = await processUserIntent(newIntent, newCachedLegs);
        if (result.status === "SUCCESS") {
            setActiveIntent(sessionId, newIntent, result.legs, result);
        }
        return result;
    }
    return { status: "EDIT_ERROR", message: "Unknown edit action." };
}
function findLegIndex(legs, query) {
    const q = query.toLowerCase();
    for (let i = 0; i < legs.length; i++) {
        const leg = legs[i];
        if (!leg)
            continue;
        let matchTokens = [];
        if (leg.event && "homeTeam" in leg.event) {
            matchTokens.push(leg.event.homeTeam, leg.event.awayTeam, ...(leg.event.aliases || []));
        }
        if (leg.market && "name" in leg.market) {
            matchTokens.push(leg.market.name, ...(leg.market.aliases || []));
        }
        if (leg.selection && "label" in leg.selection) {
            matchTokens.push(leg.selection.label, leg.selection.item?.name || "", ...(leg.selection.item?.aliases || []));
        }
        if (matchTokens.some(t => t.toLowerCase().includes(q))) {
            return i;
        }
    }
    return -1;
}
//# sourceMappingURL=agent.js.map