/**
 * Servicio de Sesiones - Maneja el almacenamiento y recuperación de sesiones
 */

class SessionService {
  constructor() {
    this.sessions = new Map();
    this.bannedIPs = new Set();
    this.redirections = new Map();
  }

  /**
   * Genera un ID de sesión único
   */
  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Crea una nueva sesión
   */
  createSession(ip, country, city) {
    const sessionId = this.generateSessionId();
    this.sessions.set(sessionId, {
      ip,
      country,
      city,
      createdAt: new Date(),
      steps: [],
      dynamics: []
    });
    console.log(`✅ Sesión creada: ${sessionId} - IP: ${ip}`);
    return sessionId;
  }

  /**
   * Obtiene una sesión
   */
  getSession(sessionId) {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Actualiza una sesión
   */
  updateSession(sessionId, data) {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    Object.assign(session, data);
    this.sessions.set(sessionId, session);
    return true;
  }

  /**
   * Guarda datos en la sesión
   */
  setSessionData(sessionId, key, value) {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    session[key] = value;
    this.sessions.set(sessionId, session);
    return true;
  }

  /**
   * Banea una IP
   */
  banIP(ip) {
    this.bannedIPs.add(ip);
    console.log(`🚫 IP BANEADA: ${ip}`);
    return true;
  }

  /**
   * Verifica si una IP está baneada
   */
  isBanned(ip) {
    return this.bannedIPs.has(ip);
  }

  /**
   * Establece una redirección para una sesión
   */
  setRedirection(sessionId, target) {
    this.redirections.set(sessionId, target);
    console.log(`📍 Redirección programada: ${target} - Session: ${sessionId}`);
  }

  /**
   * Obtiene y elimina la redirección de una sesión
   */
  getRedirection(sessionId) {
    const target = this.redirections.get(sessionId);
    if (target) {
      this.redirections.delete(sessionId);
    }
    return target;
  }

  /**
   * Limpia sesiones expiradas (mayores a 1 hora)
   */
  cleanExpiredSessions() {
    const now = Date.now();
    const ONE_HOUR = 60 * 60 * 1000;
    let cleaned = 0;

    for (const [sessionId, session] of this.sessions) {
      if (now - session.createdAt.getTime() > ONE_HOUR) {
        this.sessions.delete(sessionId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`🧹 Limpiadas ${cleaned} sesiones expiradas`);
    }
  }
}

module.exports = new SessionService();