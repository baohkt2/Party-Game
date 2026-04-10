import { sql } from '@vercel/postgres';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function migrate() {
  try {
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
