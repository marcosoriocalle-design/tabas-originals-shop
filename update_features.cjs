const fs = require('fs');
const path = require('path');

const baseDir = path.join(__dirname, 'src');

// 1. Update cartController.js to include checkout
const cartCtrlPath = path.join(baseDir, 'controllers', 'cartController.js');
fs.writeFileSync(cartCtrlPath, `
export const renderCart = (req, res) => {
    res.render('pages/cart', {
        title: 'Mi Carrito | tabas ORIGINALS',
        cartItems: []
    });
};

export const renderCheckout = (req, res) => {
    res.render('pages/checkout', {
        title: 'Finalizar Compra | tabas ORIGINALS'
    });
};
`.trim(), 'utf8');

// 2. Update shopRoutes.js
const routesPath = path.join(baseDir, 'routes', 'shopRoutes.js');
fs.writeFileSync(routesPath, `
import { Router } from 'express';
import { renderHome, renderCatalog, renderProductDetail } from '../controllers/productController.js';
import { renderCart, renderCheckout } from '../controllers/cartController.js';

const router = Router();

// Rutas de Productos y Vistas Generales
router.get('/', renderHome);
router.get('/catalogo', renderCatalog);
router.get('/producto/:id', renderProductDetail);

// Rutas del Carrito y Pago
router.get('/carrito', renderCart);
router.get('/checkout', renderCheckout);

export default router;
`.trim(), 'utf8');

// 3. Update productController.js for Filters
const productCtrlPath = path.join(baseDir, 'controllers', 'productController.js');
fs.writeFileSync(productCtrlPath, `
import { getAllProducts, getProductById } from '../models/productModel.js';

export const renderHome = (req, res) => {
    res.render('pages/home', {
        title: 'tabas ORIGINALS | Exclusividad en tus Pies',
        heroTitle: 'tabas ORIGINALS: Estilo Urbano Sin Filtros',
        heroSubtitle: 'Zapatillas urbanas exclusivas diseñadas para marcar tendencia.'
    });
};

export const renderCatalog = (req, res) => {
    const marcaFilter = req.query.marca;
    let productos = getAllProducts();
    
    if (marcaFilter && marcaFilter !== 'Todas') {
        productos = productos.filter(p => p.marca.toLowerCase() === marcaFilter.toLowerCase());
    }
    
    res.render('pages/catalog', {
        title: 'Catálogo Oficial | tabas ORIGINALS',
        productos,
        marcaSeleccionada: marcaFilter || 'Todas'
    });
};

export const renderProductDetail = (req, res) => {
    const producto = getProductById(req.params.id);

    if (!producto) {
        return res.status(404).render('pages/error', { message: 'La zapatilla solicitada no existe en tabas ORIGINALS.' });
    }

    res.render('pages/product', {
        title: \`\${producto.modelo} - tabas ORIGINALS\`,
        producto
    });
};
`.trim(), 'utf8');

// 4. Create checkout.ejs
const checkoutViewPath = path.join(baseDir, 'views', 'pages', 'checkout.ejs');
fs.writeFileSync(checkoutViewPath, `
<!DOCTYPE html>
<html lang="es">
<head>
    <title><%= title %></title>
    <%- include('../partials/header') %>
</head>
<body class="flex flex-col min-h-screen bg-brandDark text-white">
    <%- include('../partials/navbar') %>
    <main class="flex-grow container mx-auto px-4 py-12 max-w-6xl">
        <h1 class="text-3xl font-bold mb-8 uppercase border-b border-gray-800 pb-4">Finalizar Compra</h1>
        
        <div class="flex flex-col md:flex-row gap-10">
            <!-- Formulario de Datos -->
            <div class="md:w-2/3 bg-brandDarker border border-gray-800 p-8 rounded-xl shadow-lg">
                <h2 class="text-2xl font-bold mb-6 text-brandRed">Datos de Envío</h2>
                <form id="checkout-form" class="space-y-6">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label class="block text-gray-400 mb-2 font-medium">Nombre Completo</label>
                            <input type="text" required class="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white focus:outline-none focus:border-brandRed transition">
                        </div>
                        <div>
                            <label class="block text-gray-400 mb-2 font-medium">Teléfono / WhatsApp</label>
                            <input type="tel" required class="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white focus:outline-none focus:border-brandRed transition">
                        </div>
                    </div>
                    <div>
                        <label class="block text-gray-400 mb-2 font-medium">Dirección de Entrega</label>
                        <input type="text" required class="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white focus:outline-none focus:border-brandRed transition" placeholder="Av. Principal 123, Ciudad...">
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label class="block text-gray-400 mb-2 font-medium">Método de Pago</label>
                            <select class="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white focus:outline-none focus:border-brandRed transition">
                                <option>Yape / Plin / Transferencia</option>
                                <option>Pago Contra Entrega (Efectivo)</option>
                                <option>Tarjeta de Crédito / Débito</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-gray-400 mb-2 font-medium">Código de Descuento</label>
                            <input type="text" class="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white focus:outline-none focus:border-brandRed transition" placeholder="Opcional">
                        </div>
                    </div>
                    <button type="submit" class="w-full bg-brandRed hover:bg-red-700 text-white font-bold py-4 rounded-xl uppercase tracking-wider transition transform hover:-translate-y-1 shadow-lg mt-6">
                        Confirmar Pedido
                    </button>
                </form>
            </div>
            
            <!-- Resumen de Orden -->
            <div class="md:w-1/3 bg-gray-900 border border-gray-800 p-8 rounded-xl shadow-lg h-fit">
                <h2 class="text-xl font-bold mb-6 border-b border-gray-700 pb-2">Resumen de tu Orden</h2>
                <div id="checkout-items" class="space-y-4 mb-6">
                    <!-- Llenado con JS -->
                </div>
                <div class="border-t border-gray-700 pt-4 flex justify-between items-center">
                    <span class="text-gray-400 font-bold uppercase tracking-wider">Total a Pagar</span>
                    <span id="checkout-total" class="text-3xl font-bold text-brandRed">$0</span>
                </div>
            </div>
        </div>
    </main>
    
    <script>
        // Renderizar resumen
        const carrito = JSON.parse(localStorage.getItem('tabas_carrito')) || [];
        const itemsContainer = document.getElementById('checkout-items');
        const totalElement = document.getElementById('checkout-total');
        
        if (carrito.length === 0) {
            window.location.href = '/carrito';
        }
        
        let html = '';
        let total = 0;
        
        carrito.forEach(item => {
            total += item.precio * item.cantidad;
            html += \`
            <div class="flex justify-between items-center">
                <div class="flex items-center gap-3">
                    <img src="\${item.imagen}" class="w-12 h-12 object-cover rounded border border-gray-700">
                    <div>
                        <p class="font-bold text-sm">\${item.modelo}</p>
                        <p class="text-xs text-gray-400">Cant: \${item.cantidad}</p>
                    </div>
                </div>
                <p class="font-bold text-gray-300">$\${item.precio * item.cantidad}</p>
            </div>
            \`;
        });
        
        itemsContainer.innerHTML = html;
        totalElement.textContent = '$' + total;
        
        // Manejar envío
        document.getElementById('checkout-form').addEventListener('submit', function(e) {
            e.preventDefault();
            alert('¡Tu pedido ha sido confirmado!\\n\\nNos contactaremos contigo por WhatsApp para coordinar el envío.');
            localStorage.removeItem('tabas_carrito'); // Vaciar carrito
            window.location.href = '/'; // Redirigir al inicio
        });
    </script>
</body>
</html>
`.trim(), 'utf8');

// 5. Update catalog.ejs to include filters
const catalogViewPath = path.join(baseDir, 'views', 'pages', 'catalog.ejs');
fs.writeFileSync(catalogViewPath, `
<!DOCTYPE html>
<html lang="es">
<head>
    <title><%= title %></title>
    <%- include('../partials/header') %>
</head>
<body class="flex flex-col min-h-screen bg-brandDark text-white">
    <%- include('../partials/navbar') %>
    <main class="flex-grow container mx-auto px-4 py-12">
        <h1 class="text-4xl font-bold mb-8 text-center uppercase">Nuestro Catálogo</h1>
        
        <!-- Pestañas de Filtro -->
        <div class="flex flex-wrap justify-center gap-4 mb-12 border-b border-gray-800 pb-6">
            <% const marcas = ['Todas', 'Nike', 'Adidas', 'Reebok', 'Puma']; %>
            <% marcas.forEach(m => { %>
                <a href="<%= m === 'Todas' ? '/catalogo' : '/catalogo?marca=' + m %>" 
                   class="px-6 py-2 rounded-full font-bold uppercase tracking-wider transition 
                   <%= marcaSeleccionada === m ? 'bg-brandRed text-white shadow-lg shadow-red-500/30' : 'bg-gray-900 text-gray-400 hover:text-white hover:bg-gray-800 border border-gray-700' %>">
                   <%= m %>
                </a>
            <% }) %>
        </div>

        <% if (productos.length === 0) { %>
            <div class="text-center py-20">
                <p class="text-2xl text-gray-500">No encontramos zapatillas para esta marca por el momento.</p>
                <a href="/catalogo" class="inline-block mt-6 text-brandRed hover:text-white transition underline">Ver todo el catálogo</a>
            </div>
        <% } else { %>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                <% productos.forEach(producto => { %>
                    <div class="bg-brandDarker rounded-xl overflow-hidden shadow-lg border border-gray-800 hover:border-brandRed transition duration-300 group flex flex-col">
                        <div class="h-64 overflow-hidden relative">
                            <img src="<%= producto.imagen %>" alt="<%= producto.modelo %>" class="w-full h-full object-cover group-hover:scale-110 transition duration-500">
                        </div>
                        <div class="p-6 flex-grow flex flex-col">
                            <span class="text-xs font-bold text-gray-400 uppercase tracking-wider"><%= producto.marca %></span>
                            <h2 class="text-xl font-bold mt-1 mb-2"><%= producto.modelo %></h2>
                            <p class="text-brandRed text-2xl font-bold mb-4">$<%= producto.precio %></p>
                            <div class="mt-auto">
                                <a href="/producto/<%= producto.id %>" class="block w-full text-center bg-white text-black font-bold py-3 rounded hover:bg-gray-200 transition">Ver Detalles</a>
                            </div>
                        </div>
                    </div>
                <% }) %>
            </div>
        <% } %>
    </main>
</body>
</html>
`.trim(), 'utf8');

// 6. Update navbar to inject the floating WhatsApp Button globally
const navbarPath = path.join(baseDir, 'views', 'partials', 'navbar.ejs');
let navbarContent = fs.readFileSync(navbarPath, 'utf8');
if (!navbarContent.includes('WhatsApp')) {
    navbarContent += `
<!-- Botón Flotante WhatsApp Global -->
<a href="https://wa.me/51999999999?text=Hola,%20me%20interesan%20sus%20zapatillas%20exclusivas" target="_blank" title="Contáctanos por WhatsApp"
   class="fixed bottom-6 right-6 bg-green-500 text-white p-4 rounded-full shadow-[0_0_15px_rgba(34,197,94,0.5)] hover:bg-green-400 hover:scale-110 transition-transform duration-300 z-[100] flex items-center justify-center group">
    <svg class="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M12.012 2c-5.506 0-9.989 4.478-9.99 9.984a9.964 9.964 0 001.333 4.993L2 22l5.233-1.237a9.994 9.994 0 004.779 1.22h.004c5.505 0 9.988-4.478 9.989-9.985 0-2.669-1.037-5.174-2.924-7.062A9.935 9.935 0 0012.012 2zm5.796 14.136c-.247.694-1.425 1.332-1.956 1.391-.505.056-1.156.128-3.398-.802-2.716-1.127-4.469-3.905-4.606-4.088-.138-.184-1.1-1.465-1.1-2.795 0-1.33.688-1.986.932-2.26.244-.275.53-.344.707-.344.177 0 .354.001.509.008.163.007.382-.062.585.426.212.51.725 1.769.789 1.895.064.128.106.276.018.461-.088.184-.133.298-.265.45-.133.153-.277.33-.398.438-.132.116-.273.245-.122.505.151.26.673 1.112 1.446 1.802.999.893 1.826 1.171 2.091 1.298.265.127.42.106.577-.07.157-.176.679-.792.861-1.064.183-.272.366-.227.605-.137.239.091 1.51.713 1.77.843.26.13.433.195.496.303.064.109.064.63-.183 1.324z"/></svg>
</a>
`;
    fs.writeFileSync(navbarPath, navbarContent, 'utf8');
}

// 7. Update home.ejs buttons
const homePath = path.join(baseDir, 'views', 'pages', 'home.ejs');
let homeContent = fs.readFileSync(homePath, 'utf8');
homeContent = homeContent.replace(/"\/catalogo"\s+class="([^"]+)">Nike/g, '"/catalogo?marca=Nike" class="$1">Nike');
homeContent = homeContent.replace(/"\/catalogo"\s+class="([^"]+)">Adidas/g, '"/catalogo?marca=Adidas" class="$1">Adidas');
homeContent = homeContent.replace(/"\/catalogo"\s+class="([^"]+)">Reebok/g, '"/catalogo?marca=Reebok" class="$1">Reebok');
homeContent = homeContent.replace(/"\/catalogo"\s+class="([^"]+)">Puma/g, '"/catalogo?marca=Puma" class="$1">Puma');
fs.writeFileSync(homePath, homeContent, 'utf8');

// 8. Update cart.ejs Checkout button
const cartPath = path.join(baseDir, 'views', 'pages', 'cart.ejs');
let cartContent = fs.readFileSync(cartPath, 'utf8');
cartContent = cartContent.replace(
    /<button onclick="alert\\('[^']+'\\)"[^>]*>\\s*Proceder al Pago\\s*<\\/button>/,
    '<a href="/checkout" class="w-full md:w-auto bg-brandRed hover:bg-red-700 text-white font-bold py-4 px-10 rounded-xl uppercase tracking-wider transition shadow-lg shadow-red-500/30 text-center block">Proceder al Pago</a>'
);
fs.writeFileSync(cartPath, cartContent, 'utf8');

console.log('Update successful');
