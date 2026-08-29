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
  lastResult?: any; // We'll type this in agent.ts to avoid circular imports, or just use any for this internal piece
  activeSlipId?: string; // Tracks the Member 4 draft slip ID
};

const sessions: Record<string, SessionState> = {};

export function getSession(sessionId: string): SessionState {
  if (!sessions[sessionId]) {
    sessions[sessionId] = { sessionId };
  }
  return sessions[sessionId]!;
}

export function setPendingClarification(sessionId: string, clarification: PendingClarification) {
  const session = getSession(sessionId);
  session.pendingClarification = clarification;
}

export function clearPendingClarification(sessionId: string) {
  const session = getSession(sessionId);
  delete session.pendingClarification;
}

export function setActiveIntent(sessionId: string, intent: UserIntent, legs: PartialLeg[] = [], lastResult?: any) {
  const session = getSession(sessionId);
  session.activeIntent = intent;
  session.activeLegs = legs;
  if (lastResult) session.lastResult = lastResult;
}
