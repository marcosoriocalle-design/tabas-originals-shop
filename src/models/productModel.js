import pool from '../config/db.js';

// Función para adivinar la categoría por la descripción (ya que tu BD no tiene esa columna)
function getCategoria(desc) {
    if (!desc) return 'Hombre';
    desc = desc.toUpperCase();
    if (desc.includes('MUJER') || desc.includes(' W ')) return 'Mujer';
    if (desc.includes('NIÑ') || desc.includes('KID') || desc.includes(' JR') || desc.includes('INFANTIL')) return 'Niños';
    return 'Hombre';
}

// Función para poner una foto de prueba según la marca (ya que tu BD no tiene fotos)
function getImagen(marca) {
    if (!marca) return 'https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80';
    marca = marca.toUpperCase();
    if (marca.includes('NIKE')) return 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80';
    if (marca.includes('ADIDAS')) return 'https://images.unsplash.com/photo-1518002171953-a080ee817e1f?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80';
    if (marca.includes('PUMA')) return 'https://images.unsplash.com/photo-1608231387042-66d1773070a5?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80';
    return 'https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80';
}

export const getAllProducts = async () => {
    try {
        // Traemos las primeras 50 zapatillas para que el catálogo cargue súper rápido
        const result = await pool.query('SELECT * FROM tabas_originals LIMIT 50');
        
        return result.rows.map(row => ({
            id: row.Codigo, // Usamos el código de barras como ID
            modelo: row.Descripcion,
            marca: row.MARCA,
            categoria: getCategoria(row.Descripcion),
            precio: parseFloat(row['P. Venta'] || row['P.Normal'] || 0),
            tallas: [],
            descripcion: 'Modelo exclusivo disponible en nuestro catálogo de tabas ORIGINALS.',
            imagen: row.imagen_url ? row.imagen_url : getImagen(row.MARCA)
        }));
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
        return {
            id: row.Codigo,
            modelo: row.Descripcion,
            marca: row.MARCA,
            categoria: getCategoria(row.Descripcion),
            precio: parseFloat(row['P. Venta'] || row['P.Normal'] || 0),
            tallas: [],
            descripcion: 'Modelo exclusivo disponible en nuestro catálogo de tabas ORIGINALS.',
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
        return ['NIKE', 'ADIDAS', 'PUMA', 'REEBOK']; // Fallback de seguridad
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
        let query = 'SELECT * FROM tabas_originals';
        if (where.length) query += ' WHERE ' + where.join(' AND ');
        query += ` ORDER BY "Codigo" DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(pageSize, offset);
        const result = await pool.query(query, params);
        return result.rows.map(row => ({
            id: row.Codigo,
            modelo: row.Descripcion,
            marca: row.MARCA,
            categoria: getCategoria(row.Descripcion),
            precio: parseInt(row['P. Venta'] || row['P.Normal'] || 0, 10),
            tallas: [],
            descripcion: 'Modelo exclusivo disponible en nuestro catálogo de tabas ORIGINALS.',
            imagen: row.imagen_url ? row.imagen_url : getImagen(row.MARCA)
        }));
    } catch (error) {
        console.error('Error obteniendo productos paginados:', error);
        return [];
    }
};
