import { Router } from 'express';
import { clean } from '../utils/catalog.js';
import { getPaymentsConfig, mercadoPagoRequest, syncMercadoPagoOrder, validMercadoPagoWebhookSignature } from '../services/paymentService.js';

const router = Router();

router.get('/payments/config', (_req, res) => {
  const { enabled } = getPaymentsConfig();
  res.json({ provider: 'Mercado Pago', enabled });
});
router.post('/payments/mercadopago/webhook', async (req, res, next) => {
  const config = getPaymentsConfig();
  if (!config.enabled) return res.sendStatus(503);
  const dataId = String(req.query['data.id'] || '');
  if (req.query.type !== 'order' || !dataId || (req.body?.data?.id && String(req.body.data.id) !== dataId)) return res.sendStatus(400);
  if (!validMercadoPagoWebhookSignature(req, dataId, config.webhookSecret)) return res.sendStatus(401);
  try {
    const remote = await mercadoPagoRequest(`https://api.mercadopago.com/v1/orders/${encodeURIComponent(dataId)}`, config.accessToken);
    await syncMercadoPagoOrder(remote);
    res.sendStatus(200);
  } catch (error) { next(error); }
});
router.post('/payments/verify-return', async (req, res, next) => {
  const config = getPaymentsConfig();
  if (!config.enabled) return res.status(503).json({ error: 'Los pagos en línea aún no están configurados.' });
  const remoteId = clean(req.body.orderId);
  if (!/^[a-zA-Z0-9_-]{8,64}$/.test(remoteId)) return res.status(400).json({ error: 'Referencia de pago inválida.' });
  try {
    const remote = await mercadoPagoRequest(`https://api.mercadopago.com/v1/orders/${encodeURIComponent(remoteId)}`, config.accessToken);
    const result = await syncMercadoPagoOrder(remote);
    res.json({ ok: true, ...result });
  } catch (error) { res.status(error.status || 502).json({ error: error.status ? error.message : 'No se pudo verificar el pago.' }); }
});

export default router;
