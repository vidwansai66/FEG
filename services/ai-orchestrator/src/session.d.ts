import { UserIntent } from "./schemas.js";
import type { ClarificationCandidate, ProcessedLeg } from "./agent.js";
export type PartialLeg = Partial<ProcessedLeg>;
export type PendingClarification = {
    originalIntent: UserIntent;
    legIndex: number;
    step: "event" | "market" | "selection";
    candidates: ClarificationCandidate[];
    cachedLegs: PartialLeg[];
};
export type SessionState = {
    sessionId: string;
    pendingClarification?: PendingClarification;
    activeIntent?: UserIntent;
    activeLegs?: PartialLeg[];
    lastResult?: any;
};
export declare function getSession(sessionId: string): SessionState;
export declare function setPendingClarification(sessionId: string, clarification: PendingClarification): void;
export declare function clearPendingClarification(sessionId: string): void;
export declare function setActiveIntent(sessionId: string, intent: UserIntent, legs?: PartialLeg[], lastResult?: any): void;
//# sourceMappingURL=session.d.ts.map