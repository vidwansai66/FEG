import { UserIntent } from './schemas.js';
/**
 * Extracts a structured UserIntent from a natural language query using OpenRouter.
 * @param userInput The natural language query (e.g., "50 bucks on Arsenal and BTTS in the Madrid game")
 * @returns A validated UserIntent object conforming strictly to UserIntentSchema
 */
export declare function extractUserIntent(userInput: string): Promise<UserIntent>;
import { mockSearchEvents, mockSearchMarkets, mockResolveSelection, mockGetCurrentOdds } from "./mockTools.js";
import { PartialLeg } from "./session.js";
export type ResolvedEvent = Awaited<ReturnType<typeof mockSearchEvents>>[number];
export type EventResolutionResult = {
    status: "SUCCESS";
    event: ResolvedEvent;
} | {
    status: "NOT_FOUND";
    message: string;
} | {
    status: "NEEDS_CLARIFICATION";
    candidates: ResolvedEvent[];
} | {
    status: "TOOL_ERROR";
    message: string;
    isTimeout: boolean;
};
/**
 * Executes the first orchestration step: resolving an eventQuery to a verified eventId.
 */
export declare function resolveEventIntent(query: string): Promise<EventResolutionResult>;
export type ResolvedMarket = Awaited<ReturnType<typeof mockSearchMarkets>>[number];
export type MarketResolutionResult = {
    status: "SUCCESS";
    market: ResolvedMarket;
} | {
    status: "NOT_FOUND";
    message: string;
} | {
    status: "NEEDS_CLARIFICATION";
    candidates: ResolvedMarket[];
} | {
    status: "TOOL_ERROR";
    message: string;
    isTimeout: boolean;
};
/**
 * Executes the second orchestration step: resolving a marketQuery given a verified eventId.
 */
export declare function resolveMarketIntent(eventId: string, marketQuery: string): Promise<MarketResolutionResult>;
export type ResolvedSelectionCandidate = Awaited<ReturnType<typeof mockResolveSelection>>["candidates"][number];
export type SelectionResolutionResult = {
    status: "SUCCESS";
    selection: ResolvedSelectionCandidate;
} | {
    status: "NOT_FOUND";
    message: string;
} | {
    status: "NEEDS_CLARIFICATION";
    candidates: ResolvedSelectionCandidate[];
} | {
    status: "TOOL_ERROR";
    message: string;
    isTimeout: boolean;
};
/**
 * Executes the third orchestration step: resolving a selectionQuery given verified eventId and marketId.
 */
export declare function resolveSelectionIntent(eventId: string, marketId: string, selectionQuery: string): Promise<SelectionResolutionResult>;
export type ResolvedOdds = Awaited<ReturnType<typeof mockGetCurrentOdds>>[number];
export type OddsResolutionResult = {
    status: "SUCCESS";
    odds: ResolvedOdds[];
} | {
    status: "NOT_FOUND";
    message: string;
} | {
    status: "TOOL_ERROR";
    message: string;
    isTimeout: boolean;
};
/**
 * Executes the fourth orchestration step: fetching current odds for verified selection(s).
 */
export declare function resolveOddsIntent(selectionIds: string[]): Promise<OddsResolutionResult>;
export type ProcessedLeg = {
    legIndex: number;
    event: ResolvedEvent;
    market: ResolvedMarket;
    selection: ResolvedSelectionCandidate;
};
export type ClarificationCandidate = ResolvedEvent | ResolvedMarket | ResolvedSelectionCandidate;
export type OrchestrationResult = {
    status: "SUCCESS";
    stake?: number;
    legs: ProcessedLeg[];
    odds: ResolvedOdds[];
} | {
    status: "NOT_FOUND";
    legIndex: number;
    step: "event" | "market" | "selection";
    message: string;
} | {
    status: "NEEDS_CLARIFICATION";
    legIndex: number;
    step: "event" | "market" | "selection";
    candidates: ClarificationCandidate[];
    cachedLegs: PartialLeg[];
} | {
    status: "TOOL_ERROR";
    legIndex?: number;
    step?: "event" | "market" | "selection" | "odds";
    message: string;
    isTimeout?: boolean;
} | {
    status: "ODDS_FAILED";
    message: string;
} | {
    status: "CONFIRMATION_REQUIRED";
    draft: {
        stake?: number;
        legs: ProcessedLeg[];
        odds: ResolvedOdds[];
    };
} | {
    status: "CLARIFICATION_ERROR";
    message: string;
} | {
    status: "EDIT_ERROR";
    message: string;
};
/**
 * Executes the full sports orchestration workflow for a structured UserIntent.
 */
export declare function processUserIntent(intent: UserIntent, cachedLegs?: PartialLeg[]): Promise<OrchestrationResult>;
/**
 * Entry point for user messages: resolves pending clarifications or processes a new intent.
 */
export declare function processUserMessage(sessionId: string, message: string, intent?: UserIntent): Promise<OrchestrationResult | {
    status: "CLARIFICATION_ERROR";
    message: string;
}>;
export type EditIntent = {
    action: "edit_stake";
    stake: number;
} | {
    action: "remove_leg";
    legIndex?: number;
    targetQuery?: string;
} | {
    action: "change_selection";
    legIndex?: number;
    targetQuery?: string;
    newSelectionQuery: string;
};
export type ConfirmIntent = {
    action: "confirm_slip";
};
export declare function processConfirmIntent(sessionId: string): Promise<OrchestrationResult>;
/**
 * Applies an EditIntent to the currently active session state.
 */
export declare function processEditIntent(sessionId: string, edit: EditIntent): Promise<OrchestrationResult | {
    status: "EDIT_ERROR";
    message: string;
}>;
//# sourceMappingURL=agent.d.ts.map