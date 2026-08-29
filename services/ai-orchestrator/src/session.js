const sessions = {};
export function getSession(sessionId) {
    if (!sessions[sessionId]) {
        sessions[sessionId] = { sessionId };
    }
    return sessions[sessionId];
}
export function setPendingClarification(sessionId, clarification) {
    const session = getSession(sessionId);
    session.pendingClarification = clarification;
}
export function clearPendingClarification(sessionId) {
    const session = getSession(sessionId);
    delete session.pendingClarification;
}
export function setActiveIntent(sessionId, intent, legs = [], lastResult) {
    const session = getSession(sessionId);
    session.activeIntent = intent;
    session.activeLegs = legs;
    if (lastResult)
        session.lastResult = lastResult;
}
//# sourceMappingURL=session.js.map