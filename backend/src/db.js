import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'astro_blog_cms',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Test connection
try {
  const connection = await pool.getConnection();
  console.log('✅ MySQL connected successfully');
  connection.release();
} catch (error) {
  console.error('❌ MySQL connection failed:', error.message);
  console.error('Please ensure MySQL is running and database is created.');
}

export default pool;
