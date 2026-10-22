import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}
function checkPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, saved] = stored.split(':');
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(saved, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export { hashPassword, checkPassword };
export const requireAdmin = (req, res, next) => req.session.isAdmin ? next() : res.status(401).json({ error: 'Inicia sesión como administrador.' });
