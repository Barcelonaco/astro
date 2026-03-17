import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const migrate = async () => {
  console.log('🔄 Migrating pages table...');

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'astro_blog_cms'
  });

  try {
    // Check if author_id column exists
    const [columns] = await connection.query(`
      SHOW COLUMNS FROM pages LIKE 'author_id'
    `);

    if (columns.length === 0) {
      // Add author_id column
      await connection.query(`
        ALTER TABLE pages
        ADD COLUMN author_id INT NOT NULL AFTER content,
        ADD FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
      `);
      console.log('✅ Added author_id column to pages table');

      // Get the first admin user
      const [users] = await connection.query(`
        SELECT id FROM users WHERE role = 'admin' LIMIT 1
      `);

      if (users.length > 0) {
        // Update existing pages to have the admin as author
        await connection.query(`
          UPDATE pages SET author_id = ? WHERE author_id = 0
        `, [users[0].id]);
        console.log('✅ Updated existing pages with admin author');
      }
    } else {
      console.log('ℹ️  Column author_id already exists');
    }

    console.log('\n✨ Migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await connection.end();
  }
};

migrate();
