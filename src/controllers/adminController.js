import pool from '../config/db.js';

export const renderLogin = (req, res) => {
    if (req.session.isAdmin) return res.redirect('/admin');
    res.render('pages/admin/login', { title: 'Login | Administrador', error: null });
};

export const handleLogin = (req, res) => {
    const { username, password } = req.body;
    const adminUser = process.env.ADMIN_USER || 'admin';
    const adminPass = process.env.ADMIN_PASSWORD || 'tabas2024';

    if (username === adminUser && password === adminPass) {
        req.session.isAdmin = true;
        return res.redirect('/admin');
    }
    res.render('pages/admin/login', { title: 'Login | Administrador', error: 'Usuario o contraseña incorrectos' });
};

export const handleLogout = (req, res) => {
    req.session.destroy();
    res.redirect('/admin/login');
};

export const renderDashboard = async (req, res) => {
    if (!req.session.isAdmin) return res.redirect('/admin/login');
    
    try {
        // Obtenemos los productos para la tabla
        const result = await pool.query('SELECT * FROM tabas_originals ORDER BY "Codigo" DESC LIMIT 100');
        res.render('pages/admin/dashboard', { 
            title: 'Panel Secreto | tabas ORIGINALS',
            productos: result.rows
        });
    } catch (error) {
        console.error(error);
        res.send('Error cargando el panel de administrador.');
    }
};

export const uploadImage = async (req, res) => {
    if (!req.session.isAdmin) return res.status(403).send('No autorizado');
    
    const id = req.params.id;
    
    if (!req.file) {
        return res.redirect('/admin?error=No se subio ninguna foto');
    }

    const imageUrl = '/uploads/' + req.file.filename;

    try {
        await pool.query('UPDATE tabas_originals SET imagen_url = $1 WHERE "Codigo" = $2', [imageUrl, id]);
        res.redirect('/admin?success=1');
    } catch (error) {
        console.error(error);
        res.redirect('/admin?error=Error guardando en la BD');
    }
};
