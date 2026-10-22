import pool from '../config/db.js';
import { hashPassword } from './auth.js';

export const inferCategory = (description = '') => /mujer|\bw\b/i.test(description) ? 'Mujer' : /niñ|kid|jr|infantil/i.test(description) ? 'Niños' : 'Hombre';
export const toProduct = (row) => ({
  id: row.codigo,
  modelo: row.descripcion || '',
  marca: row.marca || 'OTRAS',
  categoria: row.categoria || inferCategory(row.descripcion),
  precio: Number(row.precio_venta ?? row.precio_normal ?? 0),
  precioNormal: Number(row.precio_normal || 0),
  imagen: row.imagen_url || '',
  activo: row.activo == null ? true : Boolean(row.activo),
  stock: Number(row.stock || 0),
  tallas: row.tallas || [],
});
export const positiveInteger = (value, max = 100000) => Number.isInteger(Number(value)) && Number(value) > 0 && Number(value) <= max;
export const clean = (value) => String(value ?? '').trim();
export async function seedAdmin() {
  const [[{ count }]] = await pool.query('SELECT COUNT(*) AS count FROM admin_users');
  if (Number(count) === 0 && process.env.ADMIN_PASSWORD) {
    await pool.execute('INSERT INTO admin_users (username, password_hash) VALUES (?, ?)', [process.env.ADMIN_USER || 'admin', hashPassword(process.env.ADMIN_PASSWORD)]);
  }
}
export async function sizesFor(rows) {
  if (!rows.length) return rows;
  const codes = rows.map((row) => row.codigo);
  const [sizes] = await pool.query(`SELECT codigo, talla, stock FROM product_sizes WHERE codigo IN (${codes.map(() => '?').join(',')}) ORDER BY CAST(talla AS UNSIGNED), talla`, codes);
  const grouped = new Map();
  for (const size of sizes) grouped.set(size.codigo, [...(grouped.get(size.codigo) || []), { talla: size.talla, stock: Number(size.stock) }]);
  return rows.map((row) => ({ ...row, tallas: grouped.get(row.codigo) || [] }));
}
export function validateProduct(body) {
  const product = {
    codigo: clean(body.codigo),
    descripcion: clean(body.descripcion),
    marca: clean(body.marca) || 'OTRAS',
    categoria: clean(body.categoria) || 'Hombre',
    precio_venta: Number(body.precio_venta),
    precio_normal: body.precio_normal === '' || body.precio_normal == null ? null : Number(body.precio_normal),
    activo: body.activo === false || body.activo === 'false' || body.activo === 0 || body.activo === '0' ? 0 : 1,
    tallas: Array.isArray(body.tallas) ? body.tallas : [],
  };
  if (!product.codigo || product.codigo.length > 100) return { error: 'El código es obligatorio y admite hasta 100 caracteres.' };
  if (!product.descripcion || product.descripcion.length > 500) return { error: 'El nombre o descripción es obligatorio y admite hasta 500 caracteres.' };
  if (product.marca.length > 120) return { error: 'La marca admite hasta 120 caracteres.' };
  if (!['Hombre', 'Mujer', 'Niños', 'Unisex'].includes(product.categoria)) return { error: 'Selecciona una categoría válida.' };
  if (!Number.isFinite(product.precio_venta) || product.precio_venta < 0 || product.precio_venta > 99999999) return { error: 'Ingresa un precio de venta válido.' };
  if (product.precio_normal != null && (!Number.isFinite(product.precio_normal) || product.precio_normal < 0 || product.precio_normal > 99999999)) return { error: 'Ingresa un precio anterior válido.' };
  const seen = new Set();
  for (const item of product.tallas) {
    const talla = clean(item.talla);
    if (!talla || talla.length > 20 || !Number.isInteger(Number(item.stock)) || Number(item.stock) < 0 || Number(item.stock) > 100000) return { error: 'Revisa las tallas y cantidades de stock.' };
    if (seen.has(talla.toLowerCase())) return { error: `La talla ${talla} está repetida.` };
    seen.add(talla.toLowerCase());
  }
  return { product };
}
export async function saveProductSizes(connection, codigo, sizes) {
  const incoming = new Set(sizes.map((size) => clean(size.talla).toLowerCase()));
  const [reserved] = await connection.execute(
    "SELECT DISTINCT i.talla FROM order_items i JOIN orders o ON o.id=i.order_id WHERE i.codigo=? AND i.stock_reservado=1 AND o.status IN ('pending','confirmed','preparing','shipped')",
    [codigo],
  );
  const blocked = reserved.find((row) => !incoming.has(String(row.talla).toLowerCase()));
  if (blocked) throw Object.assign(new Error(`La talla ${blocked.talla} está reservada en un pedido activo. Cambia su stock a 0 para pausarla.`), { status: 409 });
  if (sizes.length) {
    const placeholders = sizes.map(() => '?').join(',');
    await connection.execute(`DELETE FROM product_sizes WHERE codigo=? AND talla NOT IN (${placeholders})`, [codigo, ...sizes.map((size) => clean(size.talla))]);
  } else {
    await connection.execute('DELETE FROM product_sizes WHERE codigo=?', [codigo]);
  }
  for (const size of sizes) {
    await connection.execute(
      'INSERT INTO product_sizes (codigo, talla, stock) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE stock = VALUES(stock)',
      [codigo, clean(size.talla), Number(size.stock)],
    );
  }
}
