# Prueba de tabas ORIGINALS en Netlify

Esta rama adapta el proyecto para una prueba en Netlify. Mantiene el servidor local con `npm start`; la tienda usa Netlify Functions para ejecutar Express y una base MySQL remota. No subas `mysql.config`, `.env`, contraseñas ni copias de datos a GitHub.

## Qué incluye la adaptación

- Los archivos de la tienda se publican desde `src/public`.
- Las rutas `/api/*` se atienden con Express dentro de una Netlify Function.
- El inicio local conserva `npm start` y la sesión se guarda en MySQL.
- Las fotos que ya están dentro de `src/public` se publican con el sitio.
- En Netlify, la carga de nuevas fotos desde el panel queda desactivada porque el disco de una función no es persistente. No borres las fotos existentes del repositorio.

## Antes de conectar Netlify

La rama `netlify-prueba-20261022` debe estar en GitHub. En Netlify, importa el repositorio `marcosoriocalle-design/tabas-originals-shop` y selecciona esa rama como rama de producción. Netlify leerá `netlify.toml`; la carpeta publicada es `src/public`.

## Base de datos para una prueba

El plan gratis de Aiven para MySQL ofrece 1 GB y no requiere tarjeta, pero puede apagar servicios sin actividad. No es una base para ventas reales ni para datos únicos sin respaldo. Crea una base separada para la prueba; no conectes el sitio público a la base local de Laragon ni a una base de producción.

1. Crea el servicio gratuito MySQL en Aiven.
2. En HeidiSQL, conecta usando los datos de Aiven y TLS.
3. Ejecuta `database.sql` en esa instancia.
4. Importa solamente una copia de `products` y `product_sizes` desde la base local. Verifica la cantidad de productos y tallas antes de continuar.
5. Configura en Netlify estas variables privadas:

   - `NODE_ENV` = `production`
   - `NETLIFY_FUNCTIONS` = `true`
   - `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` = datos de Aiven
   - `DB_SSL` = `true`
   - `DB_CONNECTION_LIMIT` = `2`
   - `SESSION_SECRET` = clave larga y aleatoria de al menos 32 caracteres
   - `ADMIN_USER` y `ADMIN_PASSWORD` = credenciales nuevas y exclusivas para la prueba
   - `STORE_WHATSAPP` = número internacional solo con dígitos
   - `MERCADOPAGO_ACCESS_TOKEN` y `MERCADOPAGO_WEBHOOK_SECRET` = vacíos hasta configurar y verificar pagos
   - `PUBLIC_BASE_URL` = URL HTTPS que Netlify asigne al sitio

   Nunca pegues esos valores en GitHub, el código o este documento. Después de añadir las variables, vuelve a desplegar el sitio.

6. Revisa la tienda y `/api/health`. Crea un pedido solo como prueba y confirma que se guarda en la base de prueba.

## Límites

- Netlify Free tiene un límite mensual de créditos; al agotarse, pausa los proyectos hasta el siguiente ciclo.
- Aiven Free tiene 1 GB de almacenamiento y puede apagarse por inactividad.
- La carga de nuevas fotos desde el panel no funciona en esta prueba; usa las fotos ya incluidas en `src/public`.
- No habilites pagos reales ni aceptes ventas reales con esta configuración de prueba.
- Para un hosting y dominio propios en el futuro, puedes conservar la versión original: esta preparación vive en una rama separada.
