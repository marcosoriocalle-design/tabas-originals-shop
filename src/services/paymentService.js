import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import pool from '../config/db.js';
import { clean } from '../utils/catalog.js';

export function getPaymentsConfig() {
  const accessToken = clean(process.env.MERCADOPAGO_ACCESS_TOKEN);
  const webhookSecret = clean(process.env.MERCADOPAGO_WEBHOOK_SECRET);
  let baseUrl = '';
  try {
    const parsed = new URL(clean(process.env.PUBLIC_BASE_URL));
    if (parsed.protocol === 'https:' && !parsed.username && !parsed.password && parsed.pathname === '/' && !parsed.search && !parsed.hash) baseUrl = parsed.origin;
  } catch {}
  return { enabled: Boolean(accessToken && webhookSecret && baseUrl), accessToken, webhookSecret, baseUrl };
}
export const paymentKeyHash = (key) => createHash('sha256').update(key).digest('hex');
export function verifyPaymentKey(key, savedHash) {
  if (typeof key !== 'string' || !/^[a-f\d]{64}$/i.test(savedHash || '')) return false;
  const actual = Buffer.from(paymentKeyHash(key), 'hex');
  const expected = Buffer.from(savedHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export function isTrustedMercadoPagoCheckoutUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && (url.hostname === 'mercadopago.com.pe' || url.hostname.endsWith('.mercadopago.com.pe') || url.hostname === 'mercadopago.com' || url.hostname.endsWith('.mercadopago.com'));
  } catch { return false; }
}
export async function mercadoPagoRequest(url, accessToken, options = {}) {
  const response = await fetch(url, { ...options, headers: { Accept: 'application/json', ...(options.headers || {}), Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(15000) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error(`Mercado Pago respondió ${response.status} para ${new URL(url).pathname}`);
    throw Object.assign(new Error('Mercado Pago no pudo completar la operación.'), { status: 502 });
  }
  return data;
}
export async function syncMercadoPagoOrder(remote) {
  if (!remote?.id || !/^\d+$/.test(String(remote.external_reference || ''))) throw Object.assign(new Error('La orden de pago no corresponde a esta tienda.'), { status: 400 });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute('SELECT id,total,status,payment_status,mercadopago_order_id FROM orders WHERE id=? FOR UPDATE', [remote.external_reference]);
    if (!rows.length || String(rows[0].mercadopago_order_id) !== String(remote.id)) { await connection.rollback(); throw Object.assign(new Error('No se encontró el pedido local relacionado.'), { status: 404 }); }
    const order = rows[0];
    if (Number(remote.total_amount).toFixed(2) !== Number(order.total).toFixed(2) || String(remote.currency || remote.currency_id || '') !== 'PEN') {
      await connection.rollback(); throw Object.assign(new Error('El monto o la moneda del pago no coinciden con el pedido.'), { status: 409 });
    }
    const fullyPaid = remote.status === 'processed' && remote.status_detail === 'accredited' && Number(remote.total_paid_amount).toFixed(2) === Number(order.total).toFixed(2);
    const nextPaymentStatus = fullyPaid ? 'approved' : ({ created: 'pending', processing: 'processing', action_required: 'action_required', failed: 'failed', canceled: 'cancelled', refunded: 'refunded' })[remote.status] || 'processing';
    if (remote.status === 'processed' && !fullyPaid) { await connection.rollback(); throw Object.assign(new Error('El pago todavía no se puede confirmar por el monto recibido.'), { status: 409 }); }
    if ((nextPaymentStatus === 'cancelled' || nextPaymentStatus === 'refunded') && order.status === 'pending') {
      const [reserved] = await connection.execute('SELECT codigo,talla,cantidad FROM order_items WHERE order_id=? AND stock_reservado=1', [order.id]);
      for (const item of reserved) await connection.execute('UPDATE product_sizes SET stock=stock+? WHERE codigo=? AND talla=?', [item.cantidad, item.codigo, item.talla]);
      await connection.execute('UPDATE order_items SET stock_reservado=0 WHERE order_id=?', [order.id]);
      await connection.execute("UPDATE orders SET status='cancelled' WHERE id=?", [order.id]);
    } else if (fullyPaid && order.status === 'pending') {
      await connection.execute("UPDATE orders SET status='confirmed' WHERE id=?", [order.id]);
    }
    await connection.execute('UPDATE orders SET payment_status=?,payment_status_detail=? WHERE id=?', [nextPaymentStatus, clean(remote.status_detail).slice(0, 80) || null, order.id]);
    await connection.commit();
    return { payment_status: nextPaymentStatus, order_status: (nextPaymentStatus === 'approved' && order.status === 'pending') ? 'confirmed' : ((nextPaymentStatus === 'cancelled' || nextPaymentStatus === 'refunded') && order.status === 'pending' ? 'cancelled' : order.status) };
  } catch (error) { if (connection.connection?._closing !== true) await connection.rollback().catch(() => {}); throw error; }
  finally { connection.release(); }
}
export function validMercadoPagoWebhookSignature(req, dataId, secret) {
  const signature = String(req.headers['x-signature'] || '');
  const requestId = String(req.headers['x-request-id'] || '');
  const parts = Object.fromEntries(signature.split(',').map((part) => part.trim().split('=', 2)).filter((part) => part.length === 2));
  if (!dataId || !requestId || !parts.ts || !/^[a-f\d]{64}$/i.test(parts.v1 || '')) return false;
  const manifest = `id:${dataId};request-id:${requestId};ts:${parts.ts};`;
  const expected = createHmac('sha256', secret).update(manifest).digest();
  const supplied = Buffer.from(parts.v1, 'hex');
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}
