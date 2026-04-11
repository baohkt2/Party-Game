import { sql } from '@vercel/postgres';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function migrate() {
  try {
    console.log('Adding status_changed_at column to rooms...');
    await sql`ALTER TABLE rooms ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMP DEFAULT NOW();`;

    console.log('Backfilling status_changed_at values...');
    await sql`
      UPDATE rooms
      SET status_changed_at = COALESCE(status_changed_at, created_at, NOW())
      WHERE status_changed_at IS NULL
    `;

    console.log('Creating index for room TTL checks...');
    await sql`CREATE INDEX IF NOT EXISTS idx_rooms_status_changed_at ON rooms(status_changed_at);`;

    console.log('Adding config column to rooms...');
    await sql`ALTER TABLE rooms ADD COLUMN IF NOT EXISTS config JSONB DEFAULT '{"rounds":[]}'::jsonb;`;
    
    console.log('Adding scores column to players...');
    await sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS scores JSONB DEFAULT '{}'::jsonb;`;
    
    console.log('Migration successful!');
  } catch (error) {
    console.error('Migration failed:', error);
  }
}

migrate();
