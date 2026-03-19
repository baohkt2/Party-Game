import { sql } from '@vercel/postgres';
import { config } from 'dotenv';
config({ path: '.env.local' });

async function check() {
  try {
    const result = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'players';
    `;
    console.log('Columns in players table:');
    result.rows.forEach(r => console.log(`- ${r.column_name} (${r.data_type})`));
  } catch (error) {
    console.error('Error:', error);
  }
}
check();
