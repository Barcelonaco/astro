import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const migrate = async () => {
  console.log('🔄 Adding navigation fields to pages table...');

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'astro_blog_cms'
  });

  try {
    // Check if show_in_menu column exists
    const [showInMenuCol] = await connection.query(`
      SHOW COLUMNS FROM pages LIKE 'show_in_menu'
    `);

    if (showInMenuCol.length === 0) {
      await connection.query(`
        ALTER TABLE pages
        ADD COLUMN show_in_menu BOOLEAN DEFAULT TRUE AFTER status,
        ADD COLUMN menu_order INT DEFAULT 0 AFTER show_in_menu,
        ADD COLUMN parent_id INT NULL AFTER menu_order,
        ADD FOREIGN KEY (parent_id) REFERENCES pages(id) ON DELETE SET NULL,
        ADD INDEX idx_menu_order (menu_order)
      `);
      console.log('✅ Added navigation columns to pages table');
    } else {
      console.log('ℹ️  Navigation columns already exist');
    }

    console.log('\n✨ Migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await connection.end();
  }
};

migrate();
