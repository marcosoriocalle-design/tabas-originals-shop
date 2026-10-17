import pool from '../config/db.js';

// Función para imagen según la marca
function getImagen(marca) {
    if (!marca) return 'https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80';
    marca = marca.toUpperCase();
    if (marca.includes('NIKE')) return 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80';
    if (marca.includes('ADIDAS')) return 'https://images.unsplash.com/photo-1518002171953-a080ee817e1f?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80';
    if (marca.includes('PUMA')) return 'https://images.unsplash.com/photo-1608231387042-66d1773070a5?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80';
    return 'https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80';
}

// Función para extraer la talla desde la descripción
function extractTalla(desc) {
    if (!desc) return null;
    const match = desc.match(/TALLA\s*([0-9]+(?:\.[0-9]+)?(?:\s+[0-9]+\/[0-9]+)?|[SMLX]+)/i);
    return match ? match[1].trim() : null;
}

// Limpia el modelo quitando la palabra TALLA y lo que sigue para que el nombre se vea pro
function cleanModelo(desc) {
    if (!desc) return 'Zapatilla Exclusiva';
    return desc.replace(/\s*TALLA.*$/i, '').trim();
}

export const getAllProducts = async () => {
    try {
        const result = await pool.query('SELECT * FROM tabas_originals LIMIT 50');
        return result.rows.map(row => {
            const talla = extractTalla(row.Descripcion);
            return {
                id: row.Codigo,
                modelo: cleanModelo(row.Descripcion),
                descripcionCompleta: row.Descripcion,
                marca: row.MARCA,
                categoria: row.categoria || 'Hombre',
                precio: parseFloat(row['P. Venta'] || row['P.Normal'] || 0),
                tallas: talla ? [talla] : ['38', '39', '40', '41', '42'],
                descripcion: 'Modelo exclusivo disponible en nuestro catálogo de tabas ORIGINALS.',
                imagen: row.imagen_url ? row.imagen_url : getImagen(row.MARCA)
            };
        });
    } catch (error) {
        console.error('Error obteniendo productos de PostgreSQL:', error);
        return [];
    }
};

export const getProductById = async (id) => {
    try {
        const result = await pool.query('SELECT * FROM tabas_originals WHERE "Codigo" = $1', [id]);
        if (result.rows.length === 0) return null;
        
        const row = result.rows[0];
        const tallaDetectada = extractTalla(row.Descripcion);
        
        // Si tiene talla específica, la incluimos junto a las tallas estándar cercanas
        const baseTallas = ['38', '39', '40', '41', '42', '43'];
        let tallasDisponibles = baseTallas;
        if (tallaDetectada) {
            tallasDisponibles = Array.from(new Set([tallaDetectada, ...baseTallas]));
        }

        return {
            id: row.Codigo,
            modelo: cleanModelo(row.Descripcion),
            descripcionCompleta: row.Descripcion,
            marca: row.MARCA,
            categoria: row.categoria || 'Hombre',
            precio: parseFloat(row['P. Venta'] || row['P.Normal'] || 0),
            tallas: tallasDisponibles,
            tallaPorDefecto: tallaDetectada || '40',
            descripcion: 'Calzado 100% original con acabados premium y diseño icónico. Listo para entrega inmediata.',
            imagen: row.imagen_url ? row.imagen_url : getImagen(row.MARCA)
        };
    } catch (error) {
        console.error('Error obteniendo zapatilla por ID:', error);
        return null;
    }
};

export const getUniqueBrands = async () => {
    try {
        const result = await pool.query('SELECT DISTINCT "MARCA" FROM tabas_originals WHERE "MARCA" IS NOT NULL');
        return result.rows
            .map(row => row.MARCA ? row.MARCA.trim().toUpperCase() : '')
            .filter(marca => marca !== '');
    } catch (error) {
        console.error('Error obteniendo marcas:', error);
        return ['NIKE', 'ADIDAS', 'PUMA', 'REEBOK'];
    }
};

export const getProductsCount = async (filters = {}) => {
    try {
        const params = [];
        const where = [];
        if (filters.brand) {
            params.push(`%${filters.brand}%`);
            where.push(`"MARCA" ILIKE $${params.length}`);
        }
        if (filters.search) {
            params.push(`%${filters.search}%`);
            where.push(`("Descripcion" ILIKE $${params.length} OR "MARCA" ILIKE $${params.length})`);
        }
        if (filters.categoria && filters.categoria !== 'Todos') {
            params.push(filters.categoria);
            where.push(`"categoria" = $${params.length}`);
        }
        let query = 'SELECT COUNT(*) FROM tabas_originals';
        if (where.length) query += ' WHERE ' + where.join(' AND ');
        const result = await pool.query(query, params);
        return parseInt(result.rows[0].count, 10);
    } catch (error) {
        console.error('Error contando productos:', error);
        return 0;
    }
};

export const getPaginatedProducts = async (page = 1, pageSize = 12, filters = {}) => {
    try {
        const offset = (page - 1) * pageSize;
        const params = [];
        const where = [];
        if (filters.brand) {
            params.push(`%${filters.brand}%`);
            where.push(`"MARCA" ILIKE $${params.length}`);
        }
        if (filters.search) {
            params.push(`%${filters.search}%`);
            where.push(`("Descripcion" ILIKE $${params.length} OR "MARCA" ILIKE $${params.length})`);
        }
        if (filters.categoria && filters.categoria !== 'Todos') {
            params.push(filters.categoria);
            where.push(`"categoria" = $${params.length}`);
        }
        let query = 'SELECT * FROM tabas_originals';
        if (where.length) query += ' WHERE ' + where.join(' AND ');

        // Ordenamiento por precio o por defecto
        let orderClause = ' ORDER BY "Codigo" DESC';
        if (filters.orden === 'precio_asc') {
            orderClause = ' ORDER BY COALESCE("P. Venta", "P.Normal", 0) ASC';
        } else if (filters.orden === 'precio_desc') {
            orderClause = ' ORDER BY COALESCE("P. Venta", "P.Normal", 0) DESC';
        }

        query += `${orderClause} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(pageSize, offset);
        const result = await pool.query(query, params);
        return result.rows.map(row => {
            const talla = extractTalla(row.Descripcion);
            return {
                id: row.Codigo,
                modelo: cleanModelo(row.Descripcion),
                descripcionCompleta: row.Descripcion,
                marca: row.MARCA,
                categoria: row.categoria || 'Hombre',
                precio: parseInt(row['P. Venta'] || row['P.Normal'] || 0, 10),
                tallas: talla ? [talla] : ['38', '39', '40', '41', '42'],
                tallaDetectada: talla,
                descripcion: 'Modelo exclusivo disponible en nuestro catálogo de tabas ORIGINALS.',
                imagen: row.imagen_url ? row.imagen_url : getImagen(row.MARCA)
            };
        });
    } catch (error) {
        console.error('Error obteniendo productos paginados:', error);
        return [];
    }
};
