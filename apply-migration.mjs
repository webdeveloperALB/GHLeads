import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const migrationSql = readFileSync('./supabase/migrations/20251024145322_auto_assignment_rules.sql', 'utf8');

console.log('Applying migration to database...');

const { error } = await supabase.rpc('exec', { query: migrationSql });

if (error) {
  console.error('Migration error:', error);
  process.exit(1);
} else {
  console.log('✓ Migration applied successfully!');
  process.exit(0);
}
