import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import morgan from 'morgan';
import shopRoutes from './routes/shopRoutes.js';

import adminRoutes from './routes/adminRoutes.js';
import session from 'express-session';

// Configurar variables de entorno
dotenv.config();

// Configurar rutas absolutas seguras para Windows/Node.js
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Configurar sesiones de administrador
app.use(session({
    secret: 'super-secreto-tabas-1234',
    resave: false,
    saveUninitialized: false
}));

// Configurar motor de plantillas HTML (EJS) apuntando a la ruta absoluta correcta
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middlewares globales
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Rutas de la tienda y administrador
app.use('/', shopRoutes);
app.use('/admin', adminRoutes);

// Manejo de errores detallado para desarrollo
app.use((err, req, res, next) => {
    console.error("❌ Error interno del servidor:", err.message);
    res.status(500).send(`Algo salió mal en el servidor de tabas ORIGINALS. Detalle: ${err.message}`);
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor de tabas ORIGINALS corriendo en: http://localhost:${PORT}`);
});
