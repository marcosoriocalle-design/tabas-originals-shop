import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import dotenv from 'dotenv';
import morgan from 'morgan';
import session from 'express-session';
import pool from './config/db.js';
import { seedAdmin } from './utils/catalog.js';
import productRoutes from './routes/productRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import { MySqlSessionStore, startSessionCleanup } from './services/sessionStore.js';
import { getStoreConfig } from './utils/storeConfig.js';

dotenv.config({ path: 'mysql.config' });
const app = express();
const port = Number(process.env.PORT || 3001);
const configuredSessionSecret = String(process.env.SESSION_SECRET || '').trim();
if (process.env.NODE_ENV === 'production' && configuredSessionSecret.length < 32) {
  throw new Error('En producción configura SESSION_SECRET con al menos 32 caracteres aleatorios en mysql.config.');
}
const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public');
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);

app.use(morgan('dev'));
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (process.env.NODE_ENV === 'production' && _req.secure) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(session({ store: new MySqlSessionStore(), secret: configuredSessionSecret || randomBytes(48).toString('base64url'), resave: false, saveUninitialized: false, cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 8 * 60 * 60 * 1000 } }));
app.use('/uploads', express.static(path.join(publicDir, 'uploads')));
app.use(express.static(publicDir));
app.get(['/admin', '/admin/'], (_req, res) => res.sendFile(path.join(publicDir, 'admin.html')));
app.get('/payment-result', (_req, res) => res.sendFile(path.join(publicDir, 'payment-result.html')));
app.get('/api/store/config', (_req, res) => res.json(getStoreConfig()));
app.get('/api/health', async (_req, res) => { try { await pool.query('SELECT 1'); res.json({ ok: true, database: 'mysql' }); } catch { res.status(503).json({ ok: false, error: 'No se pudo conectar a MySQL. Revisa mysql.config.' }); } });
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', paymentRoutes);
app.get('*', (_req, res) => res.sendFile(path.join(publicDir, 'index.html')));
app.use((error, _req, res, _next) => { console.error(error); res.status(error.status || 500).json({ error: error.status ? error.message : 'Error interno del servidor.' }); });

seedAdmin().then(() => {
  startSessionCleanup();
  app.listen(port, () => console.log(`tabas ORIGINALS lista en http://localhost:${port}`));
}).catch((error) => { console.error('No se pudo preparar el usuario administrador. Ejecuta database.sql y revisa MySQL.', error.message); process.exitCode = 1; });
