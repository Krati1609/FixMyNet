/**
 * In-memory session store to track state across chat requests.
 * Tracks the last diagnosed fault ID per session.
 */
class SessionStore {
  constructor() {
    this.sessions = new Map();
  }

  getSession(sessionId) {
    const id = sessionId || 'default-session';
    if (!this.sessions.has(id)) {
      this.sessions.set(id, {
        id,
        lastDiagnosedFaultId: null,
        lastDiagnosedFaultName: null,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
    }
    return this.sessions.get(id);
  }

  setLastDiagnosedFault(sessionId, faultId, faultName) {
    const session = this.getSession(sessionId);
    session.lastDiagnosedFaultId = faultId;
    session.lastDiagnosedFaultName = faultName || faultId;
    session.updatedAt = Date.now();
    return session;
  }

  clearSession(sessionId) {
    const id = sessionId || 'default-session';
    this.sessions.delete(id);
  }
}

export const sessionStore = new SessionStore();
