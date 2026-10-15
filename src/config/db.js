import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'postgres', // Usamos la base de datos por defecto donde encontré tu tabla
    password: '123456',
    port: 5432,
});

export default pool;
