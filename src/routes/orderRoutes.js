import { Router } from 'express';
import { randomBytes, randomUUID } from 'node:crypto';
import pool from '../config/db.js';
import { clean, positiveInteger } from '../utils/catalog.js';
import { getStoreConfig } from '../utils/storeConfig.js';
import { getPaymentsConfig, isTrustedMercadoPagoCheckoutUrl, mercadoPagoRequest, paymentKeyHash, verifyPaymentKey } from '../services/paymentService.js';

const router = Router();

router.post('/', async (req, res, next) => {
  const customer = {
    name: clean(req.body.name), phone: clean(req.body.phone), address: clean(req.body.address), notes: clean(req.body.notes),
  };
  const paymentMethod = clean(req.body.paymentMethod) || 'whatsapp';
  if (!['whatsapp', 'mercadopago'].includes(paymentMethod)) return res.status(400).json({ error: 'Método de pago inválido.' });
  if (paymentMethod === 'whatsapp' && !getStoreConfig().whatsappEnabled) return res.status(503).json({ error: 'WhatsApp todavía no está configurado para esta tienda.' });
  if (paymentMethod === 'mercadopago' && !getPaymentsConfig().enabled) return res.status(503).json({ error: 'El pago en línea aún no está configurado con credenciales privadas y una dirección HTTPS.' });
  const orderPaymentKey = paymentMethod === 'mercadopago' ? randomBytes(32).toString('hex') : null;
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  if (!customer.name || customer.name.length > 160 || !customer.phone || customer.phone.length > 40 || !customer.address || customer.address.length > 500 || customer.notes.length > 2000) {
    return res.status(400).json({ error: 'Completa correctamente tus datos de contacto y entrega.' });
  }
  if (!items.length || items.length > 40) return res.status(400).json({ error: 'El pedido debe contener entre 1 y 40 productos.' });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    let total = 0;
    const orderItems = [];
    for (const item of items) {
      const codigo = clean(item.id);
      const cantidad = Number(item.qty);
      const talla = clean(item.talla);
      if (!codigo || !positiveInteger(cantidad, 100)) throw Object.assign(new Error('La cantidad del pedido no es válida.'), { status: 400 });
      const [products] = await connection.execute('SELECT codigo, descripcion, marca, precio_venta, precio_normal FROM products WHERE codigo=? AND activo=1 FOR UPDATE', [codigo]);
      if (!products.length) throw Object.assign(new Error('Uno de los productos ya no está disponible.'), { status: 409 });
      const product = products[0];
      const precio = Number(product.precio_venta ?? product.precio_normal ?? 0);
      const [availableSizes] = await connection.execute('SELECT talla, stock FROM product_sizes WHERE codigo=? FOR UPDATE', [codigo]);
      if (!availableSizes.length) throw Object.assign(new Error(`El inventario de ${product.descripcion} todavía no está configurado. No se puede confirmar este pedido.`), { status: 409 });
      if (!talla) throw Object.assign(new Error(`Selecciona la talla de ${product.descripcion}.`), { status: 400 });
      const selected = availableSizes.find((size) => String(size.talla) === talla);
      if (!selected) throw Object.assign(new Error(`La talla ${talla} ya no está disponible para ${product.descripcion}.`), { status: 409 });
      if (Number(selected.stock) < cantidad) throw Object.assign(new Error(`No hay stock suficiente en talla ${talla} para ${product.descripcion}.`), { status: 409 });
      await connection.execute('UPDATE product_sizes SET stock=stock-? WHERE codigo=? AND talla=?', [cantidad, codigo, talla]);
      const stockReserved = 1;
      total += precio * cantidad;
      orderItems.push({ codigo, descripcion: product.descripcion, marca: product.marca, talla: talla || null, cantidad, precio, stockReserved });
    }
    const [orderResult] = await connection.execute(
      'INSERT INTO orders (customer_name, customer_phone, delivery_address, notes, total, payment_status, payment_key_hash) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [customer.name, customer.phone, customer.address, customer.notes || null, total, paymentMethod === 'mercadopago' ? 'pending' : 'not_required', orderPaymentKey ? paymentKeyHash(orderPaymentKey) : null],
    );
    for (const item of orderItems) await connection.execute(
      'INSERT INTO order_items (order_id, codigo, descripcion, marca, talla, cantidad, precio_unitario, stock_reservado) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [orderResult.insertId, item.codigo, item.descripcion, item.marca, item.talla, item.cantidad, item.precio, item.stockReserved],
    );
    await connection.commit();
    res.status(201).json({ ok: true, id: orderResult.insertId, numero: `TO-${String(orderResult.insertId).padStart(6, '0')}`, total, ...(orderPaymentKey ? { payment_key: orderPaymentKey } : {}) });
  } catch (error) {
    await connection.rollback();
    res.status(error.status || 500).json({ error: error.status ? error.message : 'No se pudo guardar el pedido. Inténtalo otra vez.' });
  } finally { connection.release(); }
});

router.post('/:id/payment', async (req, res, next) => {
  const config = getPaymentsConfig();
  if (!config.enabled) return res.status(503).json({ error: 'El pago en línea aún no está configurado con credenciales privadas y una dirección HTTPS.' });
  if (!positiveInteger(req.params.id) || !/^[a-f\\d]{64}$/i.test(String(req.body?.paymentKey || ''))) return res.status(400).json({ error: 'No se pudo validar el acceso al pedido.' });
  const connection = await pool.getConnection();
  let order; let items; let idempotencyKey;
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute('SELECT id,total,status,payment_status,payment_key_hash,mercadopago_order_id,payment_checkout_url,payment_idempotency_key FROM orders WHERE id=? FOR UPDATE', [req.params.id]);
    if (!rows.length || !verifyPaymentKey(req.body.paymentKey, rows[0].payment_key_hash)) { await connection.rollback(); return res.status(404).json({ error: 'No se encontró el pedido.' }); }
    order = rows[0];
    if (order.status !== 'pending') { await connection.rollback(); return res.status(409).json({ error: 'Este pedido ya no puede pagarse.' }); }
    if (order.payment_status === 'approved') { await connection.rollback(); return res.status(409).json({ error: 'El pedido ya está pagado.' }); }
    if (order.mercadopago_order_id && order.payment_checkout_url) { await connection.commit(); return res.json({ ok: true, checkoutUrl: order.payment_checkout_url }); }
    idempotencyKey = order.payment_idempotency_key || randomUUID();
    const [itemRows] = await connection.execute('SELECT descripcion,precio_unitario,cantidad FROM order_items WHERE order_id=? ORDER BY id', [order.id]);
    if (!itemRows.length || Number(order.total) <= 0) { await connection.rollback(); return res.status(400).json({ error: 'El pedido no contiene artículos pagables.' }); }
    items = itemRows;
    await connection.execute("UPDATE orders SET payment_status='pending',payment_idempotency_key=? WHERE id=?", [idempotencyKey, order.id]);
    await connection.commit();
  } catch (error) { await connection.rollback(); return next(error); }
  finally { connection.release(); }
  try {
    const base = config.baseUrl;
    const remote = await mercadoPagoRequest('https://api.mercadopago.com/v1/orders', config.accessToken, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Idempotency-Key': idempotencyKey },
      body: JSON.stringify({
        type: 'online', processing_mode: 'manual', capture_mode: 'automatic_async',
        total_amount: Number(order.total).toFixed(2), external_reference: String(order.id),
        description: `Pedido tabas ORIGINALS TO-${String(order.id).padStart(6, '0')}`,
        expiration_time: 'P1D',
        config: { online: { success_url: `${base}/payment-result?estado=procesado`, failure_url: `${base}/payment-result?estado=fallido`, pending_url: `${base}/payment-result?estado=pendiente`, auto_return: 'approved' } },
        items: items.map((item) => ({ title: clean(item.descripcion).slice(0, 250) || 'Producto tabas ORIGINALS', unit_price: Number(item.precio_unitario).toFixed(2), quantity: Number(item.cantidad) })),
      }),
    });
    if (remote.external_reference && String(remote.external_reference) !== String(order.id)) throw Object.assign(new Error('La respuesta de Mercado Pago no coincide con el pedido.'), { status: 502 });
    if (!remote.id || !/^[a-zA-Z0-9_-]{8,64}$/.test(String(remote.id)) || Number(remote.total_amount).toFixed(2) !== Number(order.total).toFixed(2) || String(remote.currency || remote.currency_id || '') !== 'PEN' || !isTrustedMercadoPagoCheckoutUrl(remote.checkout_url)) throw Object.assign(new Error('No se pudo validar el checkout de Mercado Pago.'), { status: 502 });
    await pool.execute("UPDATE orders SET mercadopago_order_id=?,payment_checkout_url=?,payment_status='pending',payment_status_detail=? WHERE id=? AND payment_key_hash=?", [remote.id, remote.checkout_url, clean(remote.status_detail).slice(0, 80) || 'created', order.id, paymentKeyHash(req.body.paymentKey)]);
    res.json({ ok: true, checkoutUrl: remote.checkout_url });
  } catch (error) { res.status(error.status || 502).json({ error: error.status ? error.message : 'No se pudo iniciar el pago. Puedes volver a intentarlo.' }); }
});

export default router;
