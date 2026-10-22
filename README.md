# tabas ORIGINALS

Tienda online servida por Node.js y Express. El navegador usa HTML, CSS y JavaScript; el servidor organiza su API por dominios y persiste toda la información en MySQL.

## Inicio local

1. Inicia MySQL Server.
2. Ejecuta `database.sql` en MySQL Workbench para una instalación nueva. En una base existente, aplica `upgrade-admin.sql` y, si habilitarás pagos, `upgrade-payments.sql`.
3. Crea `mysql.config` a partir de `.env.example`; completa el acceso a MySQL, una contraseña de administrador segura, un `SESSION_SECRET` aleatorio de al menos 32 caracteres y el `STORE_WHATSAPP` real en formato internacional. La aplicación no acepta pedidos por WhatsApp si el número sigue vacío o no es válido; reinicia el servidor después de cambiar este archivo.
4. Ejecuta `npm install` y luego `npm start`.
5. Abre `http://localhost:3001`. El panel está en `http://localhost:3001/admin`.

La aplicación solo usa MySQL. El estado de la conexión se puede consultar en `/api/health`. Los productos, tallas, existencias, cuentas administrativas, pedidos, sesiones de inicio y estados de pago se almacenan en MySQL. La tabla `app_sessions` debe existir antes de iniciar el servidor: `database.sql` la incluye para bases nuevas; para una base existente, ejecuta el bloque de creación y permisos de `permisos-app-sessions.sql` conectado como administrador MySQL. La aplicación no crea tablas al arrancar.

## Organización del proyecto

- `src/app.js`: configuración del servidor, middleware y montaje de rutas.
- `src/routes/`: endpoints agrupados por productos, pedidos, administración y pagos.
- `src/services/`: integraciones de pagos y almacenamiento compartido de sesiones MySQL.
- `src/utils/`: validaciones, transformación de productos, autorización y estados de pedidos.
- `src/config/db.js`: pool de conexiones MySQL.
- `src/public/`: interfaz de la tienda y del panel administrativo.
- `database.sql`, `upgrade-admin.sql`, `upgrade-payments.sql`: esquema e incrementos compatibles con MySQL.

Las rutas se pueden ampliar por dominio sin concentrar toda la API en el arranque del servidor. Usa consultas parametrizadas y transacciones MySQL para operaciones de inventario y pedidos.

## Administración y pedidos

El usuario inicial se define con `ADMIN_USER` y `ADMIN_PASSWORD` en `mysql.config`. La contraseña se almacena en MySQL como hash. El panel permite administrar productos, precios, tallas, stock, imágenes, pedidos y estados.

Antes de aceptar pedidos, configura `STORE_WHATSAPP` en `mysql.config` con el número real en formato internacional, solo dígitos (por ejemplo, `51987654321`). Sin ese dato, la tienda oculta el acceso a WhatsApp y desactiva ese método de pedido; no usa un número de prueba.

## Inventario obligatorio

Los pedidos requieren una talla registrada y una cantidad disponible en `product_sizes`. Los productos sin inventario se muestran como pendientes y el servidor rechaza el pedido, aunque se intente enviar directamente a la API. En administración, usa la sección Inventario para descargar la plantilla CSV, completar `Talla` y `Stock` con las existencias reales y cargarla. La importación actualiza solo los pares código/talla del archivo; no elimina tallas que no estén incluidas. El Excel original no contiene cantidades de stock, por lo que estas deben ingresarse desde el conteo real.

## Mercado Pago

El checkout externo de Mercado Pago no procesa ni almacena datos de tarjetas en esta tienda. Para habilitarlo, configura `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET` y `PUBLIC_BASE_URL` con un dominio HTTPS público. Registra `https://tu-dominio/api/payments/mercadopago/webhook` como webhook de órdenes. El servidor valida la firma y consulta el estado del pago antes de confirmarlo.
