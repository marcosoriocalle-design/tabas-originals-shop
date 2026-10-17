import { getPaginatedProducts, getProductsCount, getProductById, getUniqueBrands } from '../models/productModel.js';

// Orden fijo de marcas: JULCAN siempre al final
const ORDEN_MARCAS = ['Adidas', 'Nike', 'Reebok', 'Michelin', 'Scheker', 'Puma', 'Umbro', 'Julcan'];

function ordenarMarcas(marcasDB) {
    return [...marcasDB].sort((a, b) => {
        const ia = ORDEN_MARCAS.findIndex(m => m.toLowerCase() === a.toLowerCase());
        const ib = ORDEN_MARCAS.findIndex(m => m.toLowerCase() === b.toLowerCase());
        // Si alguna marca no está en la lista, va al final
        const posA = ia === -1 ? 999 : ia;
        const posB = ib === -1 ? 999 : ib;
        return posA - posB;
    });
}

export const renderHome = async (req, res) => {
    const marcasDB = await getUniqueBrands();
    const marcas = ordenarMarcas(marcasDB);
    res.render('pages/home', {
        title: 'tabas ORIGINALS | Exclusividad en tus Pies',
        heroTitle: 'tabas ORIGINALS: Estilo Urbano Sin Filtros',
        heroSubtitle: 'Zapatillas urbanas exclusivas diseñadas para marcar tendencia.',
        marcas // Pasamos las marcas a la vista
    });
};

export const renderCatalog = async (req, res) => {
    const marcaFilter = req.query.marca;
    const categoriaFilter = req.query.categoria;
    const searchQuery = req.query.q;
    const ordenFilter = req.query.orden || '';
    const page = parseInt(req.query.page) || 1;
    const pageSize = 12;

    // Construimos filtros
    const filters = {};
    if (marcaFilter && marcaFilter !== 'Todas') filters.brand = marcaFilter;
    if (searchQuery) filters.search = searchQuery;
    if (categoriaFilter && categoriaFilter !== 'Todos') filters.categoria = categoriaFilter;
    if (ordenFilter) filters.orden = ordenFilter;

    // 1️⃣ Obtenemos los productos paginados (filtrados y ordenados en SQL)
    const productos = await getPaginatedProducts(page, pageSize, filters);
    // 2️⃣ Contamos el total para saber cuántas páginas hay
    const totalCount = await getProductsCount(filters);
    const totalPages = Math.ceil(totalCount / pageSize);

    const marcasUnicas = ordenarMarcas(await getUniqueBrands());

    res.render('pages/catalog', {
        title: 'Catálogo Oficial | tabas ORIGINALS',
        productos,
        marcas: ['Todas', ...marcasUnicas],
        marcaSeleccionada: marcaFilter || 'Todas',
        categoriaSeleccionada: categoriaFilter || 'Todos',
        searchQuery: searchQuery || '',
        ordenSeleccionado: ordenFilter,
        page,
        totalPages
    });
};

export const renderProductDetail = async (req, res) => {
    const producto = await getProductById(req.params.id);

    if (!producto) {
        return res.status(404).render('pages/error', { message: 'La zapatilla solicitada no existe en tabas ORIGINALS.' });
    }

    res.render('pages/product', {
        title: `${producto.modelo} - tabas ORIGINALS`,
        producto
    });
};
