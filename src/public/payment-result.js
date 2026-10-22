const title = document.querySelector('#payment-result-title');
const statusText = document.querySelector('#payment-result-status');
const orderId = new URLSearchParams(location.search).get('order_id');

async function verifyPaymentReturn() {
  if (!orderId || !/^[a-zA-Z0-9_-]{8,64}$/.test(orderId)) {
    title.textContent = 'No pudimos verificar el pago';
    statusText.textContent = 'Regresa a la tienda y consulta el estado de tu pedido. El estado que muestra esta página no confirma ningún cobro.';
    return;
  }
  try {
    const response = await fetch('/api/payments/verify-return', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'No se pudo verificar el pago.');
    if (result.payment_status === 'approved') {
      title.textContent = 'Pago confirmado';
      statusText.textContent = 'Mercado Pago confirmó el pago. Tu pedido quedó registrado para preparación.';
      localStorage.removeItem('tabas-cart');
    } else if (result.payment_status === 'pending' || result.payment_status === 'processing' || result.payment_status === 'action_required') {
      title.textContent = 'Pago pendiente';
      statusText.textContent = 'Mercado Pago aún no confirma el pago. Conserva tu pedido y vuelve a consultar más tarde.';
    } else {
      title.textContent = 'Pago no completado';
      statusText.textContent = 'Mercado Pago no confirmó el pago. Puedes volver a la tienda y revisar tu pedido.';
    }
  } catch (error) {
    title.textContent = 'Estado pendiente de verificación';
    statusText.textContent = `${error.message} El aviso de regreso no confirma por sí solo que se haya realizado un cobro.`;
  }
}

verifyPaymentReturn();
