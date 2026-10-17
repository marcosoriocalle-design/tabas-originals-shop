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
