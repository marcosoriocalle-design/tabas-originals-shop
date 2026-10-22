# Publicar una versión de prueba

Esta guía publica el servidor Node.js en Koyeb y usa TiDB Cloud Starter como base MySQL compatible. Está pensada para pruebas, no para aceptar ventas reales.

## Antes de empezar

La copia de trabajo contiene cambios que todavía no están en GitHub. Koyeb construye el código que está en GitHub, así que primero hay que revisar y publicar esos cambios en el repositorio. No subas `mysql.config`, `.env`, copias de la base de datos ni contraseñas. El archivo `.gitignore` ya excluye `mysql.config` y `.env`.

## 1. Preparar la base de datos en TiDB

1. Crea una instancia gratuita MySQL-compatible de TiDB Cloud Starter.
2. Copia de forma privada los datos de conexión que muestra TiDB: host, puerto, nombre de base, usuario y contraseña.
3. En HeidiSQL, conéctate a TiDB y ejecuta `database.sql` para crear las tablas. El SQL de este proyecto no crea usuarios ni concede permisos; usa el usuario que entrega TiDB.
4. Exporta desde Laragon solamente `products` y `product_sizes` y carga esas tablas en TiDB. No copies pedidos, sesiones ni usuarios administrativos de la base local para esta prueba. Comprueba cuántos productos quedaron cargados antes de continuar.

## 2. Desplegar el servidor en Koyeb

1. Crea una cuenta en Koyeb y conecta el repositorio GitHub que contiene la versión revisada del proyecto.
2. Crea un **Web Service** desde ese repositorio. Selecciona la rama publicada, el directorio raíz `.` y el método de construcción **Buildpack**.
3. Configura `npm install` como comando de construcción y `npm start` como comando de inicio.
4. Agrega estas variables en la configuración del servicio. Los valores privados se pegan directamente en Koyeb; no los compartas por el chat ni los guardes en GitHub:

   - `NODE_ENV` = `production`
   - `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` = los datos privados de TiDB
   - `DB_SSL` = `true`
   - `SESSION_SECRET` = una clave aleatoria larga de al menos 32 caracteres
   - `ADMIN_USER` = el usuario que quieras para el panel
   - `ADMIN_PASSWORD` = una contraseña nueva, larga y exclusiva
   - `STORE_WHATSAPP` = tu número en formato internacional, solo dígitos
   - `MERCADOPAGO_ACCESS_TOKEN` y `MERCADOPAGO_WEBHOOK_SECRET` = déjalos vacíos durante la prueba si no vas a habilitar pagos
5. Inicia el despliegue y abre la URL pública que Koyeb entrega. Comprueba `/api/health`, la tienda y `/admin`.

Si `admin_users` está vacía, la aplicación crea el usuario administrativo usando `ADMIN_USER` y `ADMIN_PASSWORD`. Configura esas variables antes del primer arranque.

## Límites de esta prueba gratuita

- Koyeb ofrece una instancia de prueba pequeña y la duerme tras una hora sin tráfico; la primera visita posterior puede tardar en responder.
- La instancia gratuita no tiene disco persistente. Las fotos subidas desde el panel pueden desaparecer al reconstruirse o reiniciarse el servicio. Usa imágenes incluidas dentro de `src/public/images` para esta prueba.
- TiDB Starter es compatible con MySQL en la mayoría de usos comunes, pero no implementa todas las funciones de MySQL. El proyecto no usa índices FULLTEXT.
- No configures pagos reales ni aceptes pedidos reales hasta verificar inventario, políticas, contacto, seguridad y dominio HTTPS propio.
