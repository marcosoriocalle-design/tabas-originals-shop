import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import pool from '../config/db.js';
import { clean, saveProductSizes, sizesFor, toProduct, validateProduct } from '../utils/catalog.js';
import { checkPassword, hashPassword, requireAdmin } from '../utils/auth.js';
import { orderStatuses, statusTransitions } from '../utils/orderStatus.js';

const router = Router();
const uploadDirectory = path.join(path.dirname(fileURLToPath(import.meta.url)), '../public/uploads');
const isServerless = process.env.NETLIFY === 'true' || process.env.NETLIFY_FUNCTIONS === 'true';
if (!isServerless) mkdirSync(uploadDirectory, { recursive: true });
const loginFailures = new Map();
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILURES = 5;
function checkAdminLoginLimit(req, res, next) {
  const key = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const record = loginFailures.get(key);
  if (!record || record.windowEndsAt <= now) { loginFailures.delete(key); req.adminLoginKey = key; return next(); }
  if (record.count >= LOGIN_MAX_FAILURES) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((record.windowEndsAt - now) / 1000))));
    return res.status(429).json({ error: 'Demasiados intentos. Espera 15 minutos antes de volver a intentarlo.' });
  }
  req.adminLoginKey = key;
  next();
}
function recordFailedAdminLogin(key) {
  const now = Date.now(); const previous = loginFailures.get(key);
  const record = !previous || previous.windowEndsAt <= now ? { count: 0, windowEndsAt: now + LOGIN_WINDOW_MS } : previous;
  record.count++;
  loginFailures.set(key, record);
  if (loginFailures.size > 5000) {
    for (const [ip, attempt] of loginFailures) if (attempt.windowEndsAt <= now) loginFailures.delete(ip);
  }
}

router.post('/login', checkAdminLoginLimit, async (req, res, next) => {
  try {
    const [users] = await pool.execute('SELECT username, password_hash FROM admin_users WHERE username=? LIMIT 1', [clean(req.body.username)]);
    if (!users.length || !checkPassword(String(req.body.password || ''), users[0].password_hash)) {
      recordFailedAdminLogin(req.adminLoginKey);
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
    }
    loginFailures.delete(req.adminLoginKey);
    req.session.regenerate((error) => {
      if (error) return next(error);
      req.session.isAdmin = true;
      req.session.adminUser = users[0].username;
      res.json({ ok: true });
    });
  } catch (error) { next(error); }
});
router.post('/logout', (req, res) => req.session.destroy(() => res.json({ ok: true })));
router.post('/password', requireAdmin, async (req, res, next) => {
  try {
    const oldPassword = String(req.body.currentPassword || '');
    const newPassword = String(req.body.newPassword || '');
    if (newPassword.length < 12 || newPassword.length > 200) return res.status(400).json({ error: 'La nueva contraseña debe tener entre 12 y 200 caracteres.' });
    const [rows] = await pool.execute('SELECT password_hash FROM admin_users WHERE username=?', [req.session.adminUser]);
    if (!rows.length || !checkPassword(oldPassword, rows[0].password_hash)) return res.status(400).json({ error: 'La contraseña actual no coincide.' });
    await pool.execute('UPDATE admin_users SET password_hash=? WHERE username=?', [hashPassword(newPassword), req.session.adminUser]);
    res.json({ ok: true });
  } catch (error) { next(error); }
});
router.get('/summary', requireAdmin, async (_req, res, next) => {
  try {
    const [[products]] = await pool.query('SELECT COUNT(*) AS total, SUM(activo=1) AS active, SUM(activo=0) AS archived FROM products');
    const [[lowStock]] = await pool.query('SELECT COUNT(*) AS total FROM (SELECT z.codigo, SUM(z.stock) AS total_stock FROM product_sizes z JOIN products p ON p.codigo=z.codigo WHERE p.activo=1 GROUP BY z.codigo HAVING SUM(z.stock) <= 5) AS inventory');
    const [[tracked]] = await pool.query('SELECT COUNT(DISTINCT z.codigo) AS total FROM product_sizes z JOIN products p ON p.codigo=z.codigo WHERE p.activo=1');
    const [[orders]] = await pool.query("SELECT SUM(status='pending') AS pending, COALESCE(SUM(status='delivered' AND DATE(created_at)=CURDATE()),0) AS delivered_today, COALESCE(SUM(status='delivered' AND YEAR(created_at)=YEAR(CURDATE()) AND MONTH(created_at)=MONTH(CURDATE())),0) AS delivered_month, COALESCE(SUM(CASE WHEN status='delivered' AND DATE(created_at)=CURDATE() THEN total ELSE 0 END),0) AS sales_today, COALESCE(SUM(CASE WHEN status='delivered' AND YEAR(created_at)=YEAR(CURDATE()) AND MONTH(created_at)=MONTH(CURDATE()) THEN total ELSE 0 END),0) AS sales_month FROM orders");
    res.json({ products: { total: Number(products.total || 0), active: Number(products.active || 0), archived: Number(products.archived || 0) }, inventory: { tracked: Number(tracked.total || 0), untracked: Math.max(0, Number(products.active || 0) - Number(tracked.total || 0)) }, lowStock: Number(lowStock.total || 0), orders: { pending: Number(orders.pending || 0), deliveredToday: Number(orders.delivered_today || 0), deliveredMonth: Number(orders.delivered_month || 0) }, sales: { today: Number(orders.sales_today || 0), month: Number(orders.sales_month || 0) } });
  } catch (error) { next(error); }
});

const csvCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
router.get('/inventory/template.csv', requireAdmin, async (_req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT p.codigo,p.descripcion,z.talla,z.stock FROM products p LEFT JOIN product_sizes z ON z.codigo=p.codigo ORDER BY p.codigo,CAST(z.talla AS UNSIGNED),z.talla',
    );
    const lines = ['Codigo,Descripcion,Talla,Stock'];
    for (const row of rows) lines.push([row.codigo, row.descripcion, row.talla ?? '', row.stock ?? ''].map(csvCell).join(','));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="tabas-originals-inventario.csv"');
    res.send(`\uFEFF${lines.join('\r\n')}\r\n`);
  } catch (error) { next(error); }
});

router.post('/inventory/import', requireAdmin, async (req, res, next) => {
  const items = req.body?.items;
  if (!Array.isArray(items) || !items.length || items.length > 2000) return res.status(400).json({ error: 'El archivo debe tener entre 1 y 2000 filas completas.' });
  const seen = new Set();
  const normalized = [];
  for (const item of items) {
    const codigo = clean(item?.codigo);
    const talla = clean(item?.talla);
    const stockText = String(item?.stock ?? '').trim();
    const stock = Number(stockText);
    if (!codigo || codigo.length > 100 || !talla || talla.length > 20 || !/^\d{1,6}$/.test(stockText) || !Number.isInteger(stock) || stock < 0 || stock > 100000) {
      return res.status(400).json({ error: 'Hay filas incompletas o inválidas. Cada fila debe tener Código, Talla y Stock entero entre 0 y 100000.' });
    }
    const key = `${codigo.toLocaleLowerCase('es')}\u0000${talla.toLocaleLowerCase('es')}`;
    if (seen.has(key)) return res.status(400).json({ error: `El archivo repite la talla ${talla} del producto ${codigo}. No se importó ningún cambio.` });
    seen.add(key);
    normalized.push({ codigo, talla, stock });
  }
  const connection = await pool.getConnection();
  try {
    const codes = [...new Set(normalized.map((item) => item.codigo))];
    const [existing] = await connection.query(`SELECT codigo FROM products WHERE codigo IN (${codes.map(() => '?').join(',')})`, codes);
    const existingCodes = new Set(existing.map((row) => String(row.codigo).toLocaleLowerCase('es')));
    const missing = codes.filter((code) => !existingCodes.has(code.toLocaleLowerCase('es')));
    if (missing.length) return res.status(400).json({ error: `No se importó ningún cambio. ${missing.length} códigos no existen en la tienda: ${missing.slice(0, 8).join(', ')}${missing.length > 8 ? '…' : ''}. Descarga una plantilla nueva desde administración.` });
    await connection.beginTransaction();
    normalized.sort((a, b) => a.codigo.localeCompare(b.codigo) || a.talla.localeCompare(b.talla));
    for (const item of normalized) {
      await connection.execute(
        'INSERT INTO product_sizes (codigo,talla,stock) VALUES (?,?,?) ON DUPLICATE KEY UPDATE stock=VALUES(stock)',
        [item.codigo, item.talla, item.stock],
      );
    }
    await connection.commit();
    res.json({ ok: true, imported: normalized.length });
  } catch (error) {
    await connection.rollback().catch(() => {});
    next(error);
  } finally { connection.release(); }
});

router.get('/products', requireAdmin, async (req, res, next) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(10, Number.parseInt(req.query.limit, 10) || 25));
    const conditions = [];
    const params = [];
    if (req.query.q) { conditions.push('(p.codigo LIKE ? OR p.descripcion LIKE ? OR p.marca LIKE ?)'); params.push(...Array(3).fill(`%${req.query.q}%`)); }
    if (req.query.brand && req.query.brand !== 'all') { conditions.push('p.marca=?'); params.push(req.query.brand); }
    if (req.query.status === 'active') conditions.push('p.activo=1');
    if (req.query.status === 'archived') conditions.push('p.activo=0');
    if (req.query.lowStock === '1') conditions.push('EXISTS (SELECT 1 FROM product_sizes z WHERE z.codigo=p.codigo GROUP BY z.codigo HAVING SUM(z.stock)<=5)');
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const sort = ({ newest: 'p.created_at DESC,p.codigo DESC', 'price-low': 'COALESCE(p.precio_venta,p.precio_normal,0) ASC,p.codigo DESC', 'price-high': 'COALESCE(p.precio_venta,p.precio_normal,0) DESC,p.codigo DESC', name: 'p.descripcion ASC,p.codigo DESC' })[req.query.sort] || 'p.created_at DESC,p.codigo DESC';
    const [[countRow]] = await pool.query(`SELECT COUNT(*) AS total FROM products p ${where}`, params);
    const [rows] = await pool.query(`SELECT p.*, COALESCE(z.total_stock,0) AS stock FROM products p LEFT JOIN (SELECT codigo,SUM(stock) AS total_stock FROM product_sizes GROUP BY codigo) z ON z.codigo=p.codigo ${where} ORDER BY ${sort} LIMIT ? OFFSET ?`, [...params, limit, (page - 1) * limit]);
    const [brandRows] = await pool.query("SELECT DISTINCT marca FROM products WHERE marca IS NOT NULL AND marca <> '' ORDER BY marca");
    res.json({ products: (await sizesFor(rows)).map(toProduct), brands: brandRows.map((row) => row.marca), total: Number(countRow.total), page, pages: Math.ceil(Number(countRow.total) / limit) });
  } catch (error) { next(error); }
});
router.get('/products/:id', requireAdmin, async (req, res, next) => {
  try {
    const [rows] = await pool.execute('SELECT p.*, COALESCE(z.total_stock,0) AS stock FROM products p LEFT JOIN (SELECT codigo,SUM(stock) AS total_stock FROM product_sizes GROUP BY codigo) z ON z.codigo=p.codigo WHERE p.codigo=? LIMIT 1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Producto no encontrado.' });
    res.json(toProduct((await sizesFor(rows))[0]));
  } catch (error) { next(error); }
});
router.post('/products', requireAdmin, async (req, res, next) => {
  const { product, error } = validateProduct(req.body);
  if (error) return res.status(400).json({ error });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute('INSERT INTO products (codigo,descripcion,marca,categoria,precio_venta,precio_normal,activo) VALUES (?,?,?,?,?,?,?)', [product.codigo, product.descripcion, product.marca, product.categoria, product.precio_venta, product.precio_normal, product.activo]);
    await saveProductSizes(connection, product.codigo, product.tallas);
    await connection.commit();
    res.status(201).json({ ok: true, id: product.codigo });
  } catch (error) { await connection.rollback(); if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Ya existe un producto con ese código.' }); next(error); }
  finally { connection.release(); }
});
router.put('/products/:id', requireAdmin, async (req, res, next) => {
  const { product, error } = validateProduct({ ...req.body, codigo: req.params.id });
  if (error) return res.status(400).json({ error });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [existing] = await connection.execute('SELECT codigo FROM products WHERE codigo=? FOR UPDATE', [req.params.id]);
    if (!existing.length) { await connection.rollback(); return res.status(404).json({ error: 'Producto no encontrado.' }); }
    await connection.execute('UPDATE products SET descripcion=?,marca=?,categoria=?,precio_venta=?,precio_normal=?,activo=? WHERE codigo=?', [product.descripcion, product.marca, product.categoria, product.precio_venta, product.precio_normal, product.activo, req.params.id]);
    await saveProductSizes(connection, req.params.id, product.tallas);
    await connection.commit();
    res.json({ ok: true });
  } catch (error) { await connection.rollback(); next(error); }
  finally { connection.release(); }
});
router.patch('/products/:id/status', requireAdmin, async (req, res, next) => {
  try {
    const active = req.body.active === true || req.body.active === 1 || req.body.active === '1';
    const [result] = await pool.execute('UPDATE products SET activo=? WHERE codigo=?', [active ? 1 : 0, req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Producto no encontrado.' });
    res.json({ ok: true, active });
  } catch (error) { next(error); }
});
router.delete('/products/:id', requireAdmin, async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute('SELECT activo FROM products WHERE codigo=? FOR UPDATE', [req.params.id]);
    if (!rows.length) { await connection.rollback(); return res.status(404).json({ error: 'Producto no encontrado.' }); }
    if (rows[0].activo) { await connection.rollback(); return res.status(409).json({ error: 'Archiva el producto antes de eliminarlo definitivamente.' }); }
    const [[references]] = await connection.execute('SELECT COUNT(*) AS total FROM order_items WHERE codigo=?', [req.params.id]);
    if (Number(references.total) > 0) { await connection.rollback(); return res.status(409).json({ error: 'Este producto está en el historial de pedidos y no se puede eliminar. Déjalo archivado.' }); }
    await connection.execute('DELETE FROM products WHERE codigo=?', [req.params.id]);
    await connection.commit();
    res.json({ ok: true });
  } catch (error) { await connection.rollback(); next(error); }
  finally { connection.release(); }
});

router.get('/orders', requireAdmin, async (req, res, next) => {
  try {
    const status = clean(req.query.status);
    const validStatus = status && status !== 'all' && orderStatuses.includes(status);
    const [rows] = validStatus
      ? await pool.execute('SELECT * FROM orders WHERE status=? ORDER BY created_at DESC LIMIT 250', [status])
      : await pool.query('SELECT * FROM orders ORDER BY created_at DESC LIMIT 250');
    if (!rows.length) return res.json([]);
    const ids = rows.map((row) => row.id);
    const [items] = await pool.query(`SELECT * FROM order_items WHERE order_id IN (${ids.map(() => '?').join(',')}) ORDER BY id`, ids);
    const grouped = new Map();
    for (const item of items) grouped.set(item.order_id, [...(grouped.get(item.order_id) || []), { codigo: item.codigo, descripcion: item.descripcion, marca: item.marca, talla: item.talla, cantidad: item.cantidad, precio: Number(item.precio_unitario) }]);
    res.json(rows.map((row) => ({ id: row.id, numero: `TO-${String(row.id).padStart(6, '0')}`, cliente: row.customer_name, telefono: row.customer_phone, direccion: row.delivery_address, notas: row.notes || '', total: Number(row.total), estado: row.status, payment_status: row.payment_status || 'not_required', payment_status_detail: row.payment_status_detail || '', pago_iniciado: Boolean(row.payment_idempotency_key), creado: row.created_at, items: grouped.get(row.id) || [] })));
  } catch (error) { next(error); }
});
router.patch('/orders/:id/status', requireAdmin, async (req, res, next) => {
  const status = clean(req.body.status);
  if (!orderStatuses.includes(status)) return res.status(400).json({ error: 'Estado de pedido inválido.' });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [orders] = await connection.execute('SELECT id,status,payment_status,payment_idempotency_key FROM orders WHERE id=? FOR UPDATE', [req.params.id]);
    if (!orders.length) { await connection.rollback(); return res.status(404).json({ error: 'Pedido no encontrado.' }); }
    const order = orders[0];
    if (['confirmed', 'preparing', 'shipped', 'delivered'].includes(status) && order.payment_status && !['approved', 'not_required'].includes(order.payment_status)) { await connection.rollback(); return res.status(409).json({ error: 'Este pedido todavía no tiene un pago aprobado.' }); }
    if (status === 'cancelled' && order.payment_status === 'approved') { await connection.rollback(); return res.status(409).json({ error: 'Este pedido ya está pagado. Gestiona primero el reembolso en Mercado Pago.' }); }
    if (status === 'cancelled' && order.payment_idempotency_key && !['cancelled', 'refunded'].includes(order.payment_status)) { await connection.rollback(); return res.status(409).json({ error: 'El checkout de Mercado Pago ya fue iniciado. Espera la actualización de Mercado Pago antes de liberar el pedido.' }); }
    if (order.status !== status && !statusTransitions[order.status].includes(status)) { await connection.rollback(); return res.status(409).json({ error: 'Ese cambio de estado no está permitido.' }); }
    if (status === 'cancelled' && order.status !== 'cancelled') {
      const [reserved] = await connection.execute('SELECT codigo,talla,cantidad FROM order_items WHERE order_id=? AND stock_reservado=1', [req.params.id]);
      for (const item of reserved) await connection.execute('UPDATE product_sizes SET stock=stock+? WHERE codigo=? AND talla=?', [item.cantidad, item.codigo, item.talla]);
      await connection.execute('UPDATE order_items SET stock_reservado=0 WHERE order_id=?', [req.params.id]);
    }
    await connection.execute('UPDATE orders SET status=? WHERE id=?', [status, req.params.id]);
    await connection.commit();
    res.json({ ok: true, status });
  } catch (error) { await connection.rollback(); next(error); }
  finally { connection.release(); }
});

const upload = multer({ storage: multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDirectory),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname).toLowerCase()}`),
}), limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (_req, file, cb) => cb(null, /^image\/(png|jpeg|webp|gif)$/.test(file.mimetype)) });
router.post('/products/:id/image', requireAdmin, (req, res, next) => {
  if (isServerless) return res.status(503).json({ error: 'La carga de fotos desde el panel no está disponible en esta prueba de Netlify. Las fotos ya publicadas sí se muestran.' });
  next();
}, upload.single('image'), async (req, res, next) => {
  if (!req.file) return res.status(400).json({ error: 'Selecciona una imagen válida (máximo 5 MB).' });
  try {
    const [result] = await pool.execute('UPDATE products SET imagen_url = ? WHERE codigo = ?', [`/uploads/${req.file.filename}`, req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Producto no encontrado.' });
    res.json({ ok: true, image: `/uploads/${req.file.filename}` });
  } catch (error) { next(error); }
});
router.delete('/products/:id/image', requireAdmin, async (req, res, next) => {
  try {
    const [result] = await pool.execute('UPDATE products SET imagen_url=NULL WHERE codigo=?', [req.params.id]);
    if (!result.affectedRows) {
      const [exists] = await pool.execute('SELECT codigo FROM products WHERE codigo=?', [req.params.id]);
      if (!exists.length) return res.status(404).json({ error: 'Producto no encontrado.' });
    }
    res.json({ ok: true });
  } catch (error) { next(error); }
});

export default router;
