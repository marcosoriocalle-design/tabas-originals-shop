import session from 'express-session';
import pool from '../config/db.js';

const SESSION_TTL_SECONDS = 8 * 60 * 60;

function expirationFor(sessionData) {
  const cookieExpiry = sessionData?.cookie?.expires ? new Date(sessionData.cookie.expires).getTime() : 0;
  const expiresAt = cookieExpiry || (Date.now() + (Number(sessionData?.cookie?.maxAge) || SESSION_TTL_SECONDS * 1000));
  return Math.floor(expiresAt / 1000);
}

export class MySqlSessionStore extends session.Store {
  get(sessionId, callback) {
    pool.execute('SELECT expires_at, session_data FROM app_sessions WHERE session_id=? LIMIT 1', [sessionId])
      .then(async ([rows]) => {
        if (!rows.length) return callback(null, null);
        if (Number(rows[0].expires_at) <= Math.floor(Date.now() / 1000)) {
          await this.destroy(sessionId, () => {});
          return callback(null, null);
        }
        try { callback(null, JSON.parse(rows[0].session_data)); }
        catch (error) { callback(error); }
      })
      .catch(callback);
  }

  set(sessionId, sessionData, callback = () => {}) {
    pool.execute(
      'INSERT INTO app_sessions (session_id, expires_at, session_data) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE expires_at=VALUES(expires_at), session_data=VALUES(session_data)',
      [sessionId, expirationFor(sessionData), JSON.stringify(sessionData)],
    ).then(() => callback(null)).catch(callback);
  }

  touch(sessionId, sessionData, callback = () => {}) {
    pool.execute('UPDATE app_sessions SET expires_at=? WHERE session_id=?', [expirationFor(sessionData), sessionId])
      .then(() => callback(null)).catch(callback);
  }

  destroy(sessionId, callback = () => {}) {
    pool.execute('DELETE FROM app_sessions WHERE session_id=?', [sessionId])
      .then(() => callback(null)).catch(callback);
  }

  clear(callback = () => {}) {
    pool.execute('DELETE FROM app_sessions').then(() => callback(null)).catch(callback);
  }

  length(callback) {
    pool.query('SELECT COUNT(*) AS total FROM app_sessions').then(([[row]]) => callback(null, Number(row.total))).catch(callback);
  }

  all(callback) {
    pool.execute('SELECT session_id, expires_at, session_data FROM app_sessions WHERE expires_at>? ORDER BY expires_at', [Math.floor(Date.now() / 1000)])
      .then(([rows]) => callback(null, rows.map((row) => JSON.parse(row.session_data))))
      .catch(callback);
  }
}

export function startSessionCleanup(intervalMs = 60 * 60 * 1000) {
  const timer = setInterval(() => {
    pool.execute('DELETE FROM app_sessions WHERE expires_at<=?', [Math.floor(Date.now() / 1000)]).catch((error) => console.error('No se pudieron limpiar sesiones vencidas:', error.message));
  }, intervalMs);
  timer.unref();
  return timer;
}
