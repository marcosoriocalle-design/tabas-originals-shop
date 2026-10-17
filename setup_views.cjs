const fs = require('fs');
const path = require('path');

const baseDir = path.join(__dirname, 'src', 'views');

const files = {
  'partials/header.ejs': `
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<script src="https://cdn.tailwindcss.com"></script>
<script>
    tailwind.config = {
        theme: {
            extend: {
                colors: { brandRed: '#e50914', brandDark: '#0b0b0b', brandDarker: '#141414' }
            }
        }
    }
</script>
<style>body { background-color: #0b0b0b; color: #ffffff; }</style>
`,
  'partials/navbar.ejs': `
<nav class="bg-brandDarker px-6 py-4 flex justify-between items-center border-b border-gray-800 sticky top-0 z-50 shadow-md">
    <a href="/" class="text-2xl font-bold text-white tracking-wide">
        tabas<span class="text-brandRed">ORIGINALS</span>
    </a>
    <div class="flex gap-6 items-center">
        <a href="/" class="text-white hover:text-brandRed transition font-medium">Inicio</a>
        <a href="/catalogo" class="text-white hover:text-brandRed transition font-medium">Catálogo</a>
        <a href="/carrito" class="flex items-center text-white hover:text-brandRed transition font-medium bg-gray-900 px-4 py-2 rounded-lg">
            <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
            Carrito
        </a>
    </div>
</nav>
`,
  'pages/home.ejs': `
<!DOCTYPE html>
<html lang="es">
<head>
    <title><%= title %></title>
    <%- include('../partials/header') %>
</head>
<body class="flex flex-col min-h-screen">
    <%- include('../partials/navbar') %>
    <main class="flex-grow flex flex-col justify-center items-center text-center p-6" style="min-height: calc(100vh - 72px); background: linear-gradient(rgba(11,11,11,0.7), rgba(11,11,11,0.9)), url('https://images.unsplash.com/photo-1552346154-21d32810baa3?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80') center/cover;">
        <h1 class="text-5xl md:text-7xl font-bold uppercase tracking-wider mb-4"><%= heroTitle %></h1>
        <p class="text-xl text-gray-300 max-w-2xl mb-8"><%= heroSubtitle %></p>
        <a href="/catalogo" class="bg-brandRed hover:bg-red-700 text-white font-bold py-4 px-8 rounded uppercase tracking-wider transition transform hover:scale-105 shadow-lg shadow-red-500/30">
            Ver Colección Exclusiva
        </a>
    </main>
</body>
</html>
`,
  'pages/catalog.ejs': `
<!DOCTYPE html>
<html lang="es">
<head>
    <title><%= title %></title>
    <%- include('../partials/header') %>
</head>
<body class="flex flex-col min-h-screen">
    <%- include('../partials/navbar') %>
    <main class="flex-grow container mx-auto px-4 py-12">
        <h1 class="text-4xl font-bold mb-10 text-center uppercase border-b border-gray-800 pb-4">Nuestro Catálogo</h1>
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
    </main>
</body>
</html>
`,
  'pages/product.ejs': `
<!DOCTYPE html>
<html lang="es">
<head>
    <title><%= title %></title>
    <%- include('../partials/header') %>
</head>
<body class="flex flex-col min-h-screen">
    <%- include('../partials/navbar') %>
    <main class="flex-grow container mx-auto px-4 py-12">
        <a href="/catalogo" class="inline-flex items-center text-gray-400 hover:text-white mb-6 transition">
            <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
            Volver al catálogo
        </a>
        <div class="max-w-6xl mx-auto bg-brandDarker rounded-2xl overflow-hidden shadow-2xl border border-gray-800 flex flex-col md:flex-row">
            <div class="md:w-1/2 h-96 md:h-auto">
                <img src="<%= producto.imagen %>" alt="<%= producto.modelo %>" class="w-full h-full object-cover">
            </div>
            <div class="md:w-1/2 p-10 flex flex-col justify-center">
                <p class="text-gray-400 font-bold uppercase tracking-widest mb-2"><%= producto.marca %></p>
                <h1 class="text-4xl md:text-5xl font-bold mb-4"><%= producto.modelo %></h1>
                <p class="text-3xl text-brandRed font-bold mb-6">$<%= producto.precio %></p>
                <p class="text-gray-300 mb-8 leading-relaxed text-lg"><%= producto.descripcion %></p>
                
                <div class="mb-8">
                    <h3 class="font-bold mb-3 uppercase text-sm tracking-wider text-gray-400">Tallas Disponibles (US)</h3>
                    <div class="flex gap-3 flex-wrap">
                        <% producto.tallas.forEach(talla => { %>
                            <button class="border border-gray-600 hover:border-brandRed hover:text-brandRed py-2 px-5 rounded-lg transition font-medium focus:ring-2 focus:ring-brandRed focus:outline-none">
                                <%= talla %>
                            </button>
                        <% }) %>
                    </div>
                </div>
                
                <button class="w-full bg-brandRed hover:bg-red-700 text-white font-bold py-4 rounded-xl uppercase tracking-wider transition transform hover:-translate-y-1 shadow-lg shadow-red-500/30 flex justify-center items-center gap-2 mt-auto">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                    Añadir al Carrito
                </button>
            </div>
        </div>
    </main>
</body>
</html>
`,
  'pages/cart.ejs': `
<!DOCTYPE html>
<html lang="es">
<head>
    <title><%= title %></title>
    <%- include('../partials/header') %>
</head>
<body class="flex flex-col min-h-screen">
    <%- include('../partials/navbar') %>
    <main class="flex-grow container mx-auto px-4 py-12 max-w-4xl">
        <h1 class="text-3xl font-bold mb-8 uppercase border-b border-gray-800 pb-4">Tu Carrito</h1>
        
        <% if (cartItems.length === 0) { %>
            <div class="bg-brandDarker border border-gray-800 rounded-xl p-16 text-center shadow-xl">
                <svg class="w-24 h-24 mx-auto text-gray-700 mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path></svg>
                <h2 class="text-2xl font-bold mb-4">Tu carrito está vacío</h2>
                <p class="text-gray-400 mb-8">Parece que aún no has añadido ninguna zapatilla de nuestra colección exclusiva.</p>
                <a href="/catalogo" class="inline-block bg-white text-black hover:bg-gray-200 font-bold py-3 px-8 rounded-lg uppercase tracking-wider transition shadow-lg">
                    Explorar Catálogo
                </a>
            </div>
        <% } else { %>
            <!-- Aquí irían los items -->
        <% } %>
    </main>
</body>
</html>
`,
  'pages/error.ejs': `
<!DOCTYPE html>
<html lang="es">
<head>
    <title>Error - tabas ORIGINALS</title>
    <%- include('../partials/header') %>
</head>
<body class="flex flex-col min-h-screen">
    <%- include('../partials/navbar') %>
    <main class="flex-grow flex flex-col justify-center items-center text-center px-4">
        <h1 class="text-9xl font-black text-brandRed mb-4 drop-shadow-lg">404</h1>
        <h2 class="text-3xl font-bold mb-6">Página no encontrada</h2>
        <p class="text-xl text-gray-400 mb-10 max-w-md"><%= message || 'Lo sentimos, la página que estás buscando no existe o fue movida.' %></p>
        <a href="/" class="bg-white text-black font-bold py-3 px-8 rounded-lg uppercase tracking-wider hover:bg-gray-200 transition">Volver al Inicio</a>
    </main>
</body>
</html>
`
};

Object.keys(files).forEach(relPath => {
    const fullPath = path.join(baseDir, relPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, files[relPath].trim(), 'utf8');
});

console.log('Vistas EJS actualizadas correctamente.');
