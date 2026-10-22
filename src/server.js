import app from './app.js';
import pool from './config/db.js';
import { seedAdmin } from './utils/catalog.js';
import { startSessionCleanup } from './services/sessionStore.js';

const port = Number(process.env.PORT || 3001);

try {
  await seedAdmin();
  startSessionCleanup();
  app.listen(port, () => console.log(`tabas ORIGINALS lista en http://localhost:${port}`));
} catch (error) {
  console.error('No se pudo preparar el usuario administrador. Ejecuta database.sql y revisa MySQL.', error.message);
  await pool.end();
  process.exitCode = 1;
}
