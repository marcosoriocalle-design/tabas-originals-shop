import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config({ path: 'mysql.config' });

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'tabas_originals',
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || (process.env.NETLIFY === 'true' || process.env.NETLIFY_FUNCTIONS === 'true' ? 2 : 10)),
  decimalNumbers: true,
  // TiDB Cloud Starter only accepts TLS connections on its public endpoint.
  // Leave this off for local Laragon/MySQL and set DB_SSL=true in the cloud.
  ssl: process.env.DB_SSL === 'true' ? { minVersion: 'TLSv1.2' } : undefined,
});

export default pool;
