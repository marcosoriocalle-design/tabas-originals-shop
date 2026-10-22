import { Router } from 'express';
import pool from '../config/db.js';
import { sizesFor, toProduct } from '../utils/catalog.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(48, Math.max(1, Number.parseInt(req.query.limit, 10) || 12));
    const conditions = ['p.activo = 1'];
    const params = [];
    if (req.query.brand && req.query.brand !== 'Todas') { conditions.push('p.marca LIKE ?'); params.push(`%${req.query.brand}%`); }
    if (req.query.q) { conditions.push('(p.descripcion LIKE ? OR p.marca LIKE ?)'); params.push(`%${req.query.q}%`, `%${req.query.q}%`); }
    if (req.query.category && req.query.category !== 'Todos') { conditions.push('p.categoria = ?'); params.push(req.query.category); }
    const where = `WHERE ${conditions.join(' AND ')}`;
    const [[countRow]] = await pool.query(`SELECT COUNT(*) AS total FROM products p ${where}`, params);
    const [rows] = await pool.query(
      `SELECT p.*, COALESCE(s.total_stock, 0) AS stock FROM products p LEFT JOIN (SELECT codigo, SUM(stock) AS total_stock FROM product_sizes GROUP BY codigo) s ON s.codigo=p.codigo ${where} ORDER BY p.codigo DESC LIMIT ? OFFSET ?`,
      [...params, limit, (page - 1) * limit],
    );
    const [brandRows] = await pool.query('SELECT DISTINCT marca FROM products WHERE activo=1 AND marca IS NOT NULL AND marca <> \'\' ORDER BY marca');
    res.json({ products: (await sizesFor(rows)).map(toProduct), brands: brandRows.map((row) => row.marca), total: Number(countRow.total), page, pages: Math.ceil(Number(countRow.total) / limit) });
  } catch (error) { next(error); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM products WHERE codigo = ? AND activo=1 LIMIT 1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Producto no encontrado.' });
    res.json(toProduct((await sizesFor(rows))[0]));
  } catch (error) { next(error); }
});

export default router;
