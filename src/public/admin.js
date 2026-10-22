const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const money = (amount) => new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(Number(amount || 0));
const toast = (message) => { const el = $('#toast'); el.textContent = message; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 2400); };
let pendingInventoryItems = [];
function parseInventoryCsv(text) {
  if (text.length > 1024 * 1024) throw new Error('El archivo supera el límite de 1 MB.');
  const source = text.replace(/^\uFEFF/, '');
  const firstLine = source.split(/\r?\n/, 1)[0] || '';
  const delimiter = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ',';
  const records = []; let row = []; let field = ''; let quoted = false;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') { field += '"'; i++; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === delimiter) { row.push(field); field = ''; }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((cell) => cell.trim())) records.push(row);
      row = [];
    } else field += char;
  }
  if (quoted) throw new Error('El CSV contiene comillas sin cerrar.');
  row.push(field); if (row.some((cell) => cell.trim())) records.push(row);
  if (records.length < 2) throw new Error('El CSV no tiene filas de inventario.');
  const headers = records[0].map((cell) => cell.trim().toLocaleLowerCase('es'));
  const codeIndex = headers.findIndex((header) => ['codigo', 'código'].includes(header));
  const sizeIndex = headers.indexOf('talla'); const stockIndex = headers.indexOf('stock');
  if (codeIndex < 0 || sizeIndex < 0 || stockIndex < 0) throw new Error('El encabezado debe incluir Codigo, Talla y Stock.');
  const items = [];
  for (let index = 1; index < records.length; index++) {
    const values = records[index];
    const item = { codigo: (values[codeIndex] || '').trim(), talla: (values[sizeIndex] || '').trim(), stock: (values[stockIndex] || '').trim() };
    if (!item.talla && !item.stock) continue;
    if (!item.codigo || !item.talla || !/^\d{1,6}$/.test(item.stock) || Number(item.stock) > 100000) throw new Error(`Revisa la fila ${index + 1}: completa código, talla y stock entero de 0 a 100000.`);
    items.push(item);
  }
  if (!items.length) throw new Error('Completa al menos una fila con código, talla y stock.');
  if (items.length > 2000) throw new Error('Puedes importar un máximo de 2000 filas por vez.');
  return items;
}
$('#admin-login').addEventListener('submit', async (event) => {
  event.preventDefault(); const message = $('#admin-message'); message.textContent = '';
  try {
    const body = Object.fromEntries(new FormData(event.currentTarget));
    const response = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await response.json(); if (!response.ok) { message.textContent = data.error; return; }
    event.currentTarget.classList.add('hidden'); await loadAdminDashboard();
  } catch { message.textContent = 'No se pudo iniciar sesión. Revisa la conexión e inténtalo otra vez.'; }
});

const adminState = { view: 'products', page: 1, query: '', status: 'active', brand: 'all', sort: 'newest', lowStock: false, orderStatus: 'all' };
const statusLabels = { pending: 'Pendiente', confirmed: 'Confirmado', preparing: 'Preparando', shipped: 'Enviado', delivered: 'Entregado', cancelled: 'Cancelado' };
const allowedNextStatus = { pending: ['confirmed', 'cancelled'], confirmed: ['preparing', 'cancelled'], preparing: ['shipped', 'cancelled'], shipped: ['delivered', 'cancelled'], delivered: [], cancelled: [] };
const paymentLabels = { not_required: 'Sin pago online', pending: 'Pago pendiente', processing: 'Procesando', action_required: 'Acción requerida', approved: 'Pagado', failed: 'Fallido', cancelled: 'Cancelado', refunded: 'Reembolsado' };
async function loadAdminDashboard() {
  const panel = $('#admin-panel');
  try {
    const response = await fetch('/api/admin/summary');
    if (response.status === 401) { panel.classList.add('hidden'); $('#admin-login').classList.remove('hidden'); $('#admin-message').textContent = 'Inicia sesión para abrir el panel.'; return; }
    const summary = await response.json();
    if (!response.ok) throw new Error(summary.error || 'No se pudo cargar el panel.');
    $('#admin-login').classList.add('hidden'); panel.classList.remove('hidden');
    panel.innerHTML = `<div class="admin-heading"><div><p class="eyebrow">CENTRO DE OPERACIONES</p><h3>Panel de administración</h3><p class="muted">Productos, inventario y pedidos en un solo lugar.</p></div><button id="admin-logout" class="button admin-secondary">Cerrar sesión</button></div>
      <div class="admin-stats">
        <article><span>Productos activos</span><strong>${summary.products.active}</strong><small>${summary.products.total} en catálogo</small></article>
        <article><span>Stock bajo</span><strong>${summary.lowStock}</strong><small>${summary.inventory.tracked} con tallas · ${summary.inventory.untracked} sin configurar</small></article>
        <article><span>Pedidos pendientes</span><strong>${summary.orders.pending}</strong><small>${summary.orders.deliveredToday} entregados hoy</small></article>
        <article><span>Ventas entregadas</span><strong>${money(summary.sales.today)}</strong><small>${money(summary.sales.month)} este mes</small></article>
      </div>
      ${summary.inventory.untracked ? `<p class="inventory-warning" role="alert">Hay ${summary.inventory.untracked} productos activos sin tallas y stock. No se podrán comprar hasta cargar sus existencias reales.</p>` : ''}
      <div class="admin-tabs" role="tablist"><button class="admin-tab ${adminState.view === 'products' ? 'active' : ''}" data-admin-view="products">Productos <span>${summary.products.total}</span></button><button class="admin-tab ${adminState.view === 'inventory' ? 'active' : ''}" data-admin-view="inventory">Inventario</button><button class="admin-tab ${adminState.view === 'orders' ? 'active' : ''}" data-admin-view="orders">Pedidos <span>${summary.orders.pending} pendientes</span></button><button class="admin-tab ${adminState.view === 'settings' ? 'active' : ''}" data-admin-view="settings">Seguridad</button></div>
      <div id="admin-workspace"></div>`;
    panel.onclick = handleAdminClick; panel.onchange = handleAdminChange; panel.onsubmit = handleAdminSubmit;
    await renderAdminView();
  } catch (error) { panel.classList.remove('hidden'); panel.innerHTML = `<p class="form-message">${escapeHtml(error.message)}</p>`; }
}
async function renderAdminView() {
  if (adminState.view === 'orders') return renderAdminOrders();
  if (adminState.view === 'settings') return renderAdminSettings();
  if (adminState.view === 'inventory') return renderAdminInventory();
  return renderAdminProducts();
}
function renderAdminInventory() {
  pendingInventoryItems = [];
  $('#admin-workspace').innerHTML = `<div class="settings-card inventory-card"><h4>Cargar tallas y existencias</h4><p class="muted">Descarga la plantilla vigente de productos, completa las columnas <strong>Talla</strong> y <strong>Stock</strong> con el conteo real y vuelve a subirla como CSV.</p><p class="inventory-warning">El Excel compartido contiene códigos y precios, pero no cantidades de stock. No inventes existencias: las filas sin talla y stock se omiten. La importación solo crea o actualiza los pares código/talla del archivo y no borra las demás tallas.</p><a class="button admin-secondary" href="/api/admin/inventory/template.csv">Descargar plantilla CSV</a><form id="admin-inventory-form" class="settings-form"><label>Archivo de inventario<input id="inventory-file" type="file" accept=".csv,text/csv" required></label><p id="inventory-preview" class="muted" role="status">El archivo se validará antes de guardar cambios.</p><button id="inventory-import-button" class="button primary" disabled>Importar stock</button><p id="inventory-message" class="form-message" role="status"></p></form><small class="muted">Se aceptan códigos alfanuméricos y tallas como 38, 42 2/3, S o XL. El stock debe ser entero entre 0 y 100000.</small></div>`;
}
async function renderAdminProducts() {
  const workspace = $('#admin-workspace');
  const params = new URLSearchParams({ page: adminState.page, limit: 25, status: adminState.status, brand: adminState.brand, sort: adminState.sort, q: adminState.query, lowStock: adminState.lowStock ? '1' : '0' });
  workspace.innerHTML = '<div class="admin-loading">Cargando productos…</div>';
  const response = await fetch(`/api/admin/products?${params}`); const data = await response.json();
  if (!response.ok) { workspace.innerHTML = `<p class="form-message">${escapeHtml(data.error)}</p>`; return; }
  workspace.innerHTML = `<div class="admin-section-heading"><div><h4>Catálogo</h4><p class="muted">Edita productos, precios, tallas y existencias.</p></div><button id="new-product" class="button primary">＋ Nuevo producto</button></div>
    <form id="admin-product-search" class="admin-filters"><input name="q" value="${escapeHtml(adminState.query)}" placeholder="Buscar por código, modelo o marca"><select name="brand"><option value="all">Todas las marcas</option>${data.brands.map((brand) => `<option value="${escapeHtml(brand)}" ${adminState.brand === brand ? 'selected' : ''}>${escapeHtml(brand)}</option>`).join('')}</select><select name="status"><option value="active" ${adminState.status === 'active' ? 'selected' : ''}>Activos</option><option value="archived" ${adminState.status === 'archived' ? 'selected' : ''}>Archivados</option><option value="all" ${adminState.status === 'all' ? 'selected' : ''}>Todos</option></select><select name="sort"><option value="newest" ${adminState.sort === 'newest' ? 'selected' : ''}>Más recientes</option><option value="price-low" ${adminState.sort === 'price-low' ? 'selected' : ''}>Precio: menor a mayor</option><option value="price-high" ${adminState.sort === 'price-high' ? 'selected' : ''}>Precio: mayor a menor</option><option value="name" ${adminState.sort === 'name' ? 'selected' : ''}>Nombre A–Z</option></select><label class="check-filter"><input type="checkbox" name="lowStock" ${adminState.lowStock ? 'checked' : ''}> Solo stock bajo</label><button class="button admin-secondary">Buscar</button></form>
    <div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Producto</th><th>Marca / categoría</th><th>Precio</th><th>Tallas y stock</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>${data.products.length ? data.products.map((item) => `<tr><td><div class="admin-product-cell">${item.imagen ? `<img src="${escapeHtml(item.imagen)}" alt="">` : '<div class="admin-thumb-empty">—</div>'}<div><strong>${escapeHtml(item.modelo)}</strong><small>Código ${escapeHtml(item.id)}</small></div></div></td><td>${escapeHtml(item.marca)}<small class="table-subline">${escapeHtml(item.categoria)}</small></td><td><strong>${money(item.precio)}</strong>${item.precioNormal ? `<small class="table-subline">Antes ${money(item.precioNormal)}</small>` : ''}</td><td>${item.tallas.length ? item.tallas.map((size) => `<span class="size-stock">${escapeHtml(size.talla)}: ${size.stock}</span>`).join(' ') + `<small class="table-subline">Total: ${item.stock}</small>` : '<span class="muted">Stock pendiente de configurar</span>'}</td><td><span class="status-pill ${item.activo ? 'status-active' : 'status-archived'}">${item.activo ? 'Activo' : 'Archivado'}</span></td><td><div class="table-actions"><button class="table-action" data-edit-product="${escapeHtml(item.id)}">Editar</button><button class="table-action ${item.activo ? 'danger' : ''}" data-toggle-product="${escapeHtml(item.id)}" data-active="${item.activo ? '1' : '0'}">${item.activo ? 'Archivar' : 'Publicar'}</button>${item.activo ? '' : `<button class="table-action danger" data-delete-product="${escapeHtml(item.id)}">Eliminar</button>`}</div></td></tr>`).join('') : '<tr><td colspan="6" class="table-empty">No hay productos que coincidan con esos filtros.</td></tr>'}</tbody></table></div>
    <div class="admin-pagination"><span class="muted">${data.total} productos · página ${data.page} de ${Math.max(1, data.pages)}</span><div><button class="button admin-secondary" data-product-page="${Math.max(1, data.page - 1)}" ${data.page <= 1 ? 'disabled' : ''}>Anterior</button><button class="button admin-secondary" data-product-page="${Math.min(data.pages || 1, data.page + 1)}" ${data.page >= data.pages ? 'disabled' : ''}>Siguiente</button></div></div>`;
}
async function renderAdminOrders() {
  const workspace = $('#admin-workspace');
  const params = new URLSearchParams({ status: adminState.orderStatus });
  workspace.innerHTML = '<div class="admin-loading">Cargando pedidos…</div>';
  const response = await fetch(`/api/admin/orders?${params}`); const orders = await response.json();
  if (!response.ok) { workspace.innerHTML = `<p class="form-message">${escapeHtml(orders.error)}</p>`; return; }
  workspace.innerHTML = `<div class="admin-section-heading"><div><h4>Pedidos</h4><p class="muted">Los pedidos nuevos se guardan aquí; el pago online solo figura como pagado tras confirmación de Mercado Pago.</p></div><select id="order-status-filter"><option value="all">Todos los estados</option>${Object.entries(statusLabels).map(([key, label]) => `<option value="${key}" ${adminState.orderStatus === key ? 'selected' : ''}>${label}</option>`).join('')}</select></div>
    <div class="admin-table-wrap"><table class="admin-table order-table"><thead><tr><th>Pedido / fecha</th><th>Cliente</th><th>Artículos</th><th>Total</th><th>Pago</th><th>Estado del pedido</th></tr></thead><tbody>${orders.length ? orders.map((order) => `<tr><td><strong>${escapeHtml(order.numero)}</strong><small class="table-subline">${new Date(order.creado).toLocaleString('es-PE')}</small></td><td><strong>${escapeHtml(order.cliente)}</strong><a class="table-subline phone-link" href="tel:${escapeHtml(order.telefono)}">${escapeHtml(order.telefono)}</a><small class="table-subline">${escapeHtml(order.direccion)}</small>${order.notas ? `<small class="table-subline">Nota: ${escapeHtml(order.notas)}</small>` : ''}</td><td>${order.items.map((item) => `<div>${item.cantidad} × ${escapeHtml(item.descripcion)}${item.talla ? ` · talla ${escapeHtml(item.talla)}` : ''}</div>`).join('')}</td><td><strong>${money(order.total)}</strong></td><td><span class="status-pill ${order.payment_status === 'approved' ? 'status-active' : 'status-archived'}">${paymentLabels[order.payment_status] || 'Desconocido'}</span>${order.payment_status_detail ? `<small class="table-subline">${escapeHtml(order.payment_status_detail)}</small>` : ''}</td><td><select class="order-status-select" data-order-status="${order.id}" data-current-status="${order.estado}"><option value="${order.estado}" selected>${statusLabels[order.estado]}</option>${(allowedNextStatus[order.estado] || []).filter((status) => status === 'cancelled' ? order.payment_status !== 'approved' && !order.pago_iniciado : ['approved', 'not_required'].includes(order.payment_status)).map((status) => `<option value="${status}">${statusLabels[status]}</option>`).join('')}</select></td></tr>`).join('') : '<tr><td colspan="6" class="table-empty">No hay pedidos para este filtro.</td></tr>'}</tbody></table></div>`;
}
function renderAdminSettings() {
  $('#admin-workspace').innerHTML = `<div class="settings-card"><h4>Cambiar contraseña</h4><p class="muted">Usa una contraseña única de al menos 12 caracteres.</p><form id="admin-password-form" class="settings-form"><label>Contraseña actual<input type="password" name="currentPassword" autocomplete="current-password" required></label><label>Nueva contraseña<input type="password" name="newPassword" autocomplete="new-password" minlength="12" required></label><label>Repite la contraseña nueva<input type="password" name="confirmPassword" autocomplete="new-password" minlength="12" required></label><button class="button primary">Guardar contraseña</button><p id="password-message" class="form-message"></p></form></div>`;
}
function openProductEditor(product = null) {
  const dialog = $('#admin-product-dialog'); const host = $('#admin-product-dialog-content');
  const sizes = (product?.tallas || []).map((size) => `${size.talla}:${size.stock}`).join('\n');
  host.innerHTML = `<div class="dialog-heading"><div><p class="eyebrow">CATÁLOGO</p><h3>${product ? 'Editar producto' : 'Crear producto'}</h3></div><button class="dialog-close admin-dialog-close" aria-label="Cerrar">×</button></div><form id="admin-product-form" data-id="${product ? escapeHtml(product.id) : ''}" class="product-editor-form">
    <label>Código<input name="codigo" value="${escapeHtml(product?.id || '')}" maxlength="100" ${product ? 'readonly' : ''} required></label>
    <label>Nombre o descripción<input name="descripcion" value="${escapeHtml(product?.modelo || '')}" maxlength="500" required></label>
    <div class="form-pair"><label>Marca<input name="marca" value="${escapeHtml(product?.marca === 'OTRAS' ? '' : product?.marca || '')}" maxlength="120" placeholder="Ej. Nike" required></label><label>Categoría<select name="categoria">${['Hombre','Mujer','Niños','Unisex'].map((category) => `<option ${product?.categoria === category ? 'selected' : ''}>${category}</option>`).join('')}</select></label></div>
    <div class="form-pair"><label>Precio de venta (S/)<input name="precio_venta" type="number" min="0" step="0.01" value="${product ? product.precio : ''}" required></label><label>Precio anterior (S/)<input name="precio_normal" type="number" min="0" step="0.01" value="${product?.precioNormal || ''}"></label></div>
    <label>Tallas y stock <small class="muted">Una por línea, formato talla:unidades. Usa 0 para pausar una talla.</small><textarea name="sizes" rows="5" placeholder="38:2&#10;39:4&#10;40:3">${escapeHtml(sizes)}</textarea></label>
    <label class="file-picker">Foto del producto <input type="file" name="image" accept="image/png,image/jpeg,image/webp,image/gif">${product?.imagen ? `<small class="muted">Ya tiene una foto cargada.</small><button type="button" class="table-action danger" data-remove-product-image="${escapeHtml(product.id)}">Quitar foto</button>` : ''}</label>
    <label class="check-filter"><input type="checkbox" name="activo" ${product?.activo !== false ? 'checked' : ''}> Publicado en la tienda</label><p class="form-message" id="product-form-message"></p><button class="button primary">${product ? 'Guardar cambios' : 'Crear producto'}</button></form>`;
  dialog.showModal();
}
async function handleAdminClick(event) {
  const tab = event.target.closest('[data-admin-view]');
  if (tab) { adminState.view = tab.dataset.adminView; $('#admin-panel').querySelectorAll('.admin-tab').forEach((button) => button.classList.toggle('active', button === tab)); await renderAdminView(); return; }
  if (event.target.closest('#admin-logout')) { await fetch('/api/admin/logout', { method: 'POST' }); $('#admin-panel').classList.add('hidden'); $('#admin-login').classList.remove('hidden'); $('#admin-login').reset(); return; }
  if (event.target.closest('#new-product')) { openProductEditor(); return; }
  const page = event.target.closest('[data-product-page]');
  if (page) { adminState.page = Number(page.dataset.productPage); await renderAdminProducts(); return; }
  const edit = event.target.closest('[data-edit-product]');
  if (edit) { const response = await fetch(`/api/admin/products/${encodeURIComponent(edit.dataset.editProduct)}`); const product = await response.json(); if (!response.ok) return toast(product.error); openProductEditor(product); return; }
  const toggle = event.target.closest('[data-toggle-product]');
  if (toggle) {
    const active = toggle.dataset.active !== '1';
    if (!active && !window.confirm('¿Archivar este producto? Dejará de aparecer en la tienda.')) return;
    const response = await fetch(`/api/admin/products/${encodeURIComponent(toggle.dataset.toggleProduct)}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active }) });
    const result = await response.json(); if (!response.ok) return toast(result.error);
    toast(active ? 'Producto publicado' : 'Producto archivado'); await loadAdminDashboard(); return;
  }
  const remove = event.target.closest('[data-delete-product]');
  if (remove) {
    if (!window.confirm('¿Eliminar este producto definitivamente? La acción no se puede deshacer.')) return;
    const response = await fetch(`/api/admin/products/${encodeURIComponent(remove.dataset.deleteProduct)}`, { method: 'DELETE' });
    const result = await response.json(); if (!response.ok) return toast(result.error || 'No se pudo eliminar el producto.');
    toast('Producto eliminado'); await loadAdminDashboard();
  }
}
async function handleAdminChange(event) {
  if (event.target.matches('#inventory-file')) {
    pendingInventoryItems = [];
    const preview = $('#inventory-preview'); const button = $('#inventory-import-button');
    button.disabled = true; $('#inventory-message').textContent = '';
    const file = event.target.files?.[0];
    if (!file) { preview.textContent = 'Elige un archivo CSV.'; return; }
    try {
      pendingInventoryItems = parseInventoryCsv(await file.text());
      preview.textContent = `${pendingInventoryItems.length} filas válidas. No se guardará nada hasta que pulses “Importar stock”.`;
      button.disabled = false;
    } catch (error) { preview.textContent = error.message; }
    return;
  }
  if (event.target.matches('#admin-product-search select,#admin-product-search input[type="checkbox"]')) {
    if (event.target.name === 'status') adminState.status = event.target.value;
    if (event.target.name === 'brand') adminState.brand = event.target.value;
    if (event.target.name === 'sort') adminState.sort = event.target.value;
    if (event.target.name === 'lowStock') adminState.lowStock = event.target.checked;
    adminState.page = 1; await renderAdminProducts(); return;
  }
  if (event.target.matches('#order-status-filter')) { adminState.orderStatus = event.target.value; await renderAdminOrders(); return; }
  const statusSelect = event.target.closest('[data-order-status]');
  if (statusSelect && statusSelect.value !== statusSelect.dataset.currentStatus) {
    const response = await fetch(`/api/admin/orders/${statusSelect.dataset.orderStatus}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: statusSelect.value }) });
    const result = await response.json(); if (!response.ok) { toast(result.error); return loadAdminDashboard(); }
    toast('Estado del pedido actualizado'); await loadAdminDashboard();
  }
}
async function handleAdminSubmit(event) {
  if (event.target.matches('#admin-inventory-form')) {
    event.preventDefault();
    if (!pendingInventoryItems.length) return;
    const button = $('#inventory-import-button'); const message = $('#inventory-message');
    button.disabled = true; button.textContent = 'Importando…'; message.textContent = '';
    try {
      const response = await fetch('/api/admin/inventory/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: pendingInventoryItems }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'No se pudo importar el inventario.');
      toast(`${result.imported} tallas importadas o actualizadas`);
      await loadAdminDashboard();
    } catch (error) {
      message.textContent = error.message;
      button.disabled = false;
    } finally { button.textContent = 'Importar stock'; }
    return;
  }
  if (event.target.matches('#admin-product-search')) { event.preventDefault(); const form = new FormData(event.target); adminState.query = String(form.get('q') || '').trim(); adminState.status = String(form.get('status') || 'active'); adminState.brand = String(form.get('brand') || 'all'); adminState.sort = String(form.get('sort') || 'newest'); adminState.lowStock = form.has('lowStock'); adminState.page = 1; await renderAdminProducts(); return; }
  if (event.target.matches('#admin-password-form')) {
    event.preventDefault(); const form = new FormData(event.target); const message = $('#password-message'); message.textContent = '';
    if (form.get('newPassword') !== form.get('confirmPassword')) { message.textContent = 'Las contraseñas nuevas no coinciden.'; return; }
    const response = await fetch('/api/admin/password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword: form.get('currentPassword'), newPassword: form.get('newPassword') }) });
    const result = await response.json(); message.textContent = result.error || 'Contraseña actualizada.'; message.classList.toggle('success', response.ok); if (response.ok) event.target.reset(); return;
  }
}
$('#admin-product-dialog').addEventListener('click', async (event) => {
  if (event.target.closest('.admin-dialog-close')) { $('#admin-product-dialog').close(); return; }
  const removeImage = event.target.closest('[data-remove-product-image]');
  if (!removeImage) return;
  if (!window.confirm('¿Quitar la foto de este producto?')) return;
  const response = await fetch(`/api/admin/products/${encodeURIComponent(removeImage.dataset.removeProductImage)}/image`, { method: 'DELETE' });
  const result = await response.json(); if (!response.ok) return toast(result.error || 'No se pudo quitar la foto.');
  const productResponse = await fetch(`/api/admin/products/${encodeURIComponent(removeImage.dataset.removeProductImage)}`);
  const product = await productResponse.json(); if (productResponse.ok) openProductEditor(product);
  toast('Foto quitada del producto');
});
$('#admin-product-dialog').addEventListener('submit', async (event) => {
  if (!event.target.matches('#admin-product-form')) return;
  event.preventDefault(); const form = event.target; const raw = new FormData(form); const message = $('#product-form-message'); message.textContent = '';
  const sizes = String(raw.get('sizes') || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
    const [talla, amount] = line.split(':').map((part) => part.trim());
    return { talla, stock: Number(amount) };
  });
  if (sizes.some((size) => !size.talla || !Number.isInteger(size.stock) || size.stock < 0)) { message.textContent = 'Escribe las existencias como talla:unidades, por ejemplo 39:3.'; return; }
  const payload = { codigo: raw.get('codigo'), descripcion: raw.get('descripcion'), marca: raw.get('marca'), categoria: raw.get('categoria'), precio_venta: raw.get('precio_venta'), precio_normal: raw.get('precio_normal'), activo: raw.has('activo'), tallas: sizes };
  const id = form.dataset.id; const response = await fetch(id ? `/api/admin/products/${encodeURIComponent(id)}` : '/api/admin/products', { method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const result = await response.json(); if (!response.ok) { message.textContent = result.error || 'No se pudo guardar el producto.'; return; }
  const productId = id || result.id; const image = raw.get('image');
  if (image?.size) {
    const imageForm = new FormData(); imageForm.append('image', image);
    const uploadResponse = await fetch(`/api/admin/products/${encodeURIComponent(productId)}/image`, { method: 'POST', body: imageForm });
    const uploadResult = await uploadResponse.json(); if (!uploadResponse.ok) { message.textContent = uploadResult.error || 'El producto se guardó, pero no se pudo subir la foto.'; return; }
  }
  $('#admin-product-dialog').close(); toast(id ? 'Producto actualizado' : 'Producto creado'); await loadAdminDashboard();
});

loadAdminDashboard();
