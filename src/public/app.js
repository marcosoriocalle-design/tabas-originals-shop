function readSavedCart() {
  try {
    const saved = JSON.parse(localStorage.getItem('tabas-cart') || '[]');
    return Array.isArray(saved) ? saved.filter((item) => item && item.id != null && Number(item.qty) > 0) : [];
  } catch { return []; }
}
const state = { page: 1, category: 'Todos', brand: 'Todas', q: '', products: [], cart: readSavedCart() };
const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const money = (amount) => new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(Number(amount || 0));
const productPrices = (product) => {
  const hasPreviousPrice = Number(product.precioNormal) > Number(product.precio);
  return `<div class="product-prices">${hasPreviousPrice ? `<span class="price-old-line"><span class="price-label">Antes</span><del class="price-before">${money(product.precioNormal)}</del></span>` : ''}<strong class="price">${hasPreviousPrice ? '<span class="price-label">Ahora</span> ' : ''}${money(product.precio)}</strong></div>`;
};
const toast = (message) => { const el = $('#toast'); el.textContent = message; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 2400); };
let whatsappNumber = '';

async function loadProducts() {
  const grid = $('#product-grid'); grid.innerHTML = '<div class="loading">Cargando colección…</div>';
  const params = new URLSearchParams({ page: state.page, limit: 12, category: state.category, brand: state.brand, q: state.q });
  try {
    const response = await fetch(`/api/products?${params}`);
    if (!response.ok) throw new Error('No se pudo cargar el catálogo.');
    const data = await response.json(); state.products = data.products;
    $('#result-count').textContent = `${data.total} modelos`;
    const brands = data.brands || [];
    $('#brand-filter').innerHTML = '<option value="Todas">Todas las marcas</option>' + brands.map((brand) => `<option value="${escapeHtml(brand)}">${escapeHtml(brand)}</option>`).join('');
    $('#brand-filter').value = state.brand;
    $('#home-brands').innerHTML = brands.slice(0, 7).map((brand) => `<button class="chip" data-home-brand="${escapeHtml(brand)}">${escapeHtml(brand)}</button>`).join('');
    grid.innerHTML = state.products.length ? state.products.map(productCard).join('') : '<div class="empty">No encontramos modelos con esos filtros.</div>';
    $('#pagination').innerHTML = paginationMarkup(data.page, data.pages);
  } catch (error) { grid.innerHTML = `<div class="empty">${escapeHtml(error.message)} Asegúrate de que el servidor y MySQL estén activos.</div>`; }
}
function paginationMarkup(page, pages) {
  if (pages <= 1) return '';
  const visible = new Set([1, pages]);
  for (let number = Math.max(2, page - 2); number <= Math.min(pages - 1, page + 2); number++) visible.add(number);
  const ordered = [...visible].sort((a, b) => a - b);
  const buttons = [`<button data-page="${Math.max(1, page - 1)}" aria-label="Página anterior" ${page <= 1 ? 'disabled' : ''}>‹</button>`];
  let previous = 0;
  for (const number of ordered) {
    if (previous && number - previous > 1) buttons.push('<span class="pagination-gap" aria-hidden="true">…</span>');
    buttons.push(`<button class="${number === page ? 'active' : ''}" data-page="${number}" aria-label="Página ${number}" ${number === page ? 'aria-current="page"' : ''}>${number}</button>`);
    previous = number;
  }
  buttons.push(`<button data-page="${Math.min(pages, page + 1)}" aria-label="Página siguiente" ${page >= pages ? 'disabled' : ''}>›</button>`);
  return buttons.join('');
}function productCard(product) {
  const image = product.imagen ? `<img src="${escapeHtml(product.imagen)}" alt="${escapeHtml(product.modelo)}" loading="lazy">` : '<div class="image-placeholder">◌</div>';
  const hasSizes = product.tallas?.length > 0;
  const outOfStock = !hasSizes || product.tallas.every((size) => size.stock < 1);
  const action = hasSizes
    ? `<button class="add-to-cart" data-open-product="${escapeHtml(product.id)}" ${outOfStock ? 'disabled' : ''}>${outOfStock ? 'Agotado' : 'Elegir talla'}</button>`
    : `<button class="add-to-cart" disabled aria-label="Inventario pendiente para ${escapeHtml(product.modelo)}">Stock pendiente</button>`;
  return `<article class="product-card" data-product="${escapeHtml(product.id)}"><div class="product-image">${image}</div><div class="product-info"><div class="product-brand">${escapeHtml(product.marca)}</div><h3>${escapeHtml(product.modelo)}</h3><div class="product-card-bottom">${productPrices(product)}${action}</div></div></article>`;
}
function saveCart() { localStorage.setItem('tabas-cart', JSON.stringify(state.cart)); updateCart(); }
function updateCart() {
  $('#cart-count').textContent = state.cart.reduce((sum, item) => sum + item.qty, 0);
  const host = $('#cart-content');
  if (!state.cart.length) { host.innerHTML = '<p class="muted">Tu carrito está vacío. <a href="#catalogo">Explora el catálogo →</a></p>'; return; }
  const total = state.cart.reduce((sum, item) => sum + item.precio * item.qty, 0);
  host.innerHTML = state.cart.map((item) => `<div class="cart-row"><img src="${escapeHtml(item.imagen || '')}" alt=""><div><h3>${escapeHtml(item.modelo)}</h3><span class="muted">${escapeHtml(item.marca)}${item.talla ? ` · Talla ${escapeHtml(item.talla)}` : ''} · ${money(item.precio)}</span></div><div class="qty"><button data-qty="-1" data-id="${escapeHtml(item.id)}" data-size="${escapeHtml(item.talla || '')}">−</button><span>${item.qty}</span><button data-qty="1" data-id="${escapeHtml(item.id)}" data-size="${escapeHtml(item.talla || '')}">+</button><button class="remove" data-remove="${escapeHtml(item.id)}" data-size="${escapeHtml(item.talla || '')}">Quitar</button></div><div class="price">${money(item.precio * item.qty)}</div></div>`).join('') + `<div class="cart-summary"><span>Total</span><strong class="cart-total">${money(total)}</strong><a class="button primary" href="#checkout">Continuar</a></div>`;
}
function addToCart(product, talla = '') { const item = state.cart.find((entry) => String(entry.id) === String(product.id) && String(entry.talla || '') === talla); item ? item.qty++ : state.cart.push({ ...product, talla, qty: 1 }); saveCart(); toast('Añadido a tu carrito'); }
async function showProduct(id) {
  const product = state.products.find((entry) => String(entry.id) === String(id));
  if (!product) return;
  const sizeOptions = (product.tallas || []).filter((size) => size.stock > 0);
  const inventoryTracked = (product.tallas || []).length > 0;
  const sizeControl = product.tallas?.length
    ? `<label class="size-choice">Talla<select id="product-size" required><option value="">Selecciona una talla</option>${sizeOptions.map((size) => `<option value="${escapeHtml(size.talla)}">${escapeHtml(size.talla)} · ${size.stock} disponibles</option>`).join('')}</select></label>`
    : '<p class="inventory-warning">Stock pendiente de configuración. Este producto todavía no se puede pedir.</p>';
  const disabled = !inventoryTracked || !sizeOptions.length ? 'disabled' : '';
  $('#dialog-content').innerHTML = `<div class="detail"><img src="${escapeHtml(product.imagen || '')}" alt="${escapeHtml(product.modelo)}"><div><p class="product-brand">${escapeHtml(product.marca)} · ${escapeHtml(product.categoria)}</p><h2>${escapeHtml(product.modelo)}</h2><p class="muted">Modelo exclusivo disponible en nuestro catálogo.</p>${productPrices(product)}${sizeControl}<button class="button primary" id="add-from-detail" ${disabled}>${!inventoryTracked ? 'Stock pendiente' : disabled ? 'Agotado' : 'Agregar al carrito'}</button></div></div>`;
  $('#product-dialog').showModal();
  $('#add-from-detail').onclick = () => { const size = $('#product-size')?.value || ''; if (product.tallas?.length && !size) return toast('Selecciona una talla.'); addToCart(product, size); $('#product-dialog').close(); };
}

$('#search-form').addEventListener('submit', (event) => { event.preventDefault(); state.q = $('#search-input').value.trim(); state.page = 1; location.hash = 'catalogo'; loadProducts(); });
$('#brand-filter').addEventListener('change', (event) => { state.brand = event.target.value; state.page = 1; loadProducts(); });
$('#category-filters').addEventListener('click', (event) => { const button = event.target.closest('[data-category]'); if (!button) return; state.category = button.dataset.category; state.page = 1; document.querySelectorAll('[data-category]').forEach((item) => item.classList.toggle('active', item === button)); loadProducts(); });
$('#product-grid').addEventListener('click', (event) => {
  const addButton = event.target.closest('[data-add-to-cart]');
  if (addButton) {
    event.stopPropagation();
    const product = state.products.find((item) => String(item.id) === addButton.dataset.addToCart);
    if (product) addToCart(product);
    return;
  }
  const chooseButton = event.target.closest('[data-open-product]');
  if (chooseButton) { event.stopPropagation(); showProduct(chooseButton.dataset.openProduct); return; }
  const card = event.target.closest('[data-product]'); if (card) showProduct(card.dataset.product);
});
$('#pagination').addEventListener('click', (event) => { const button = event.target.closest('[data-page]'); if (button) { state.page = Number(button.dataset.page); loadProducts(); $('#catalogo').scrollIntoView(); } });
$('#home-brands').addEventListener('click', (event) => { const button = event.target.closest('[data-home-brand]'); if (button) { state.brand = button.dataset.homeBrand; state.page = 1; location.hash = 'catalogo'; loadProducts(); } });
$('.dialog-close').addEventListener('click', () => $('#product-dialog').close());
$('#cart-content').addEventListener('click', (event) => {
  const qty = event.target.closest('[data-qty]'); const remove = event.target.closest('[data-remove]');
  if (qty) { const item = state.cart.find((entry) => String(entry.id) === qty.dataset.id && String(entry.talla || '') === qty.dataset.size); if (!item) return; item.qty += Number(qty.dataset.qty); if (item.qty <= 0) state.cart = state.cart.filter((entry) => entry !== item); saveCart(); }
  if (remove) { state.cart = state.cart.filter((item) => !(String(item.id) === remove.dataset.remove && String(item.talla || '') === remove.dataset.size)); saveCart(); }
});
async function loadPaymentAvailability() {
  const button = $('#pay-online');
  const whatsappButton = $('#pay-whatsapp');
  const message = $('#payment-readiness');
  try {
    const [paymentResponse, storeResponse] = await Promise.all([fetch('/api/payments/config'), fetch('/api/store/config')]);
    const [config, store] = await Promise.all([paymentResponse.json(), storeResponse.json()]);
    paymentReady = paymentResponse.ok && config.enabled === true;
    whatsappNumber = storeResponse.ok && store.whatsappEnabled === true ? String(store.whatsappNumber || '') : '';
    const contactLink = $('.whatsapp-float');
    if (whatsappNumber) {
      contactLink.href = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent('Hola, me interesa su catálogo de zapatillas')}`;
      contactLink.classList.remove('hidden');
    } else {
      contactLink.classList.add('hidden');
    }
    button.disabled = !paymentReady;
    whatsappButton.disabled = !whatsappNumber;
    message.textContent = paymentReady
      ? (whatsappNumber ? 'Pago online disponible con Mercado Pago. También puedes continuar por WhatsApp.' : 'Pago online disponible con Mercado Pago.')
      : (whatsappNumber ? 'El pago online se activará al configurar Mercado Pago y un dominio HTTPS. Puedes continuar por WhatsApp.' : 'Los métodos de pago están pendientes de configuración.');
  } catch {
    paymentReady = false;
    whatsappNumber = '';
    button.disabled = true;
    whatsappButton.disabled = true;
    $('.whatsapp-float').classList.add('hidden');
    message.textContent = 'No se pudieron consultar las opciones de pago y contacto.';
  }
}
let paymentReady = false;
$('#checkout-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!state.cart.length) return toast('Tu carrito está vacío.');
  const checkoutForm = event.currentTarget;
  const method = event.submitter?.value || 'whatsapp';
  if (method === 'mercadopago' && !paymentReady) return toast('El pago online aún no está disponible.');
  if (method === 'whatsapp' && !whatsappNumber) return toast('WhatsApp todavía no está configurado para esta tienda.');
  const message = $('#checkout-message');
  message.textContent = '';
  const form = new FormData(checkoutForm);
  const customer = { name: form.get('name'), phone: form.get('phone'), address: form.get('address'), notes: form.get('notes') || '' };
  const items = state.cart.map((item) => ({ id: item.id, qty: item.qty, talla: item.talla || '' }));
  const whatsappPopup = method === 'whatsapp' ? window.open('about:blank', '_blank') : null;
  const buttons = checkoutForm.querySelectorAll('button[type="submit"]');
  buttons.forEach((button) => { button.disabled = true; });
  const submitButton = event.submitter;
  if (submitButton) submitButton.textContent = method === 'mercadopago' ? 'Preparando pago seguro…' : 'Guardando pedido…';
  try {
    const response = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...customer, items, paymentMethod: method }) });
    const order = await response.json();
    if (!response.ok) throw new Error(order.error || 'No se pudo guardar el pedido.');
    if (method === 'mercadopago') {
      const paymentResponse = await fetch(`/api/orders/${encodeURIComponent(order.id)}/payment`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paymentKey: order.payment_key }) });
      const payment = await paymentResponse.json();
      if (!paymentResponse.ok) throw new Error(`${payment.error || 'No se pudo iniciar el pago.'} Tu pedido ${order.numero} quedó registrado; conserva este número para consultarlo.`);
      window.location.assign(payment.checkoutUrl);
      return;
    }
    const lines = state.cart.map((item) => `• ${item.qty} x ${item.modelo}${item.talla ? ` (talla ${item.talla})` : ''} — ${money(item.precio * item.qty)}`).join('\n');
    const text = `¡Hola! Acabo de registrar el pedido ${order.numero} en tabas ORIGINALS.\n\n${lines}\n\nTotal: ${money(order.total)}\nNombre: ${customer.name}\nTeléfono: ${customer.phone}\nDirección: ${customer.address}\nNotas: ${customer.notes || '-'}`;
    const url = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(text)}`;
    if (whatsappPopup) whatsappPopup.location.href = url;
    else message.textContent = `Pedido ${order.numero} guardado. Permite las ventanas emergentes para enviarlo por WhatsApp.`;
    state.cart = []; saveCart(); checkoutForm.reset();
  } catch (error) {
    if (whatsappPopup) whatsappPopup.close();
    message.textContent = error.message;
  } finally {
    buttons.forEach((button) => { button.disabled = button.value === 'mercadopago' ? !paymentReady : !whatsappNumber; });
    if (submitButton) submitButton.textContent = method === 'mercadopago' ? 'Pagar con Mercado Pago' : 'Continuar por WhatsApp';
  }
});window.addEventListener('hashchange', () => $('#checkout').classList.toggle('hidden', location.hash !== '#checkout'));
if (location.hash === '#checkout') $('#checkout').classList.remove('hidden');
updateCart(); loadProducts(); loadPaymentAvailability();
