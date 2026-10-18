import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { renderLogin, handleLogin, renderDashboard, uploadImage, deleteImage, handleLogout } from '../controllers/adminController.js';

const router = Router();

// Configuración para subir imágenes (se guardarán en src/public/uploads/)
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'src/public/uploads/');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Rutas de Login
router.get('/login', renderLogin);
router.post('/login', handleLogin);
router.get('/logout', handleLogout);

// Rutas protegidas del Panel
router.get('/', renderDashboard);
router.post('/producto/:id/imagen', upload.single('imagen'), uploadImage);
router.post('/producto/:id/imagen/eliminar', deleteImage);

export default router;
