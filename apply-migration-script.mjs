import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const supabaseUrl = 'https://kwiuzntxxsmezjgswact.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3aXV6bnR4eHNtZXpqZ3N3YWN0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MjU2OTA4NCwiZXhwIjoyMDU4MTQ1MDg0fQ.vvRtXPUV2Gp2YQcqQXYUiDMQBmMBaOPAVSxwkzXDpLg';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const migrationPath = join(__dirname, 'supabase/migrations/20251024145322_auto_assignment_rules.sql');
const migrationSql = readFileSync(migrationPath, 'utf8');

console.log('Reading migration file...');
console.log('Applying migration to database...\n');

// Remove comments and split by semicolon
const cleanSql = migrationSql
  .split('\n')
  .filter(line => !line.trim().startsWith('--'))
  .join('\n')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const statements = cleanSql
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0);

let successCount = 0;
let errorCount = 0;

for (const statement of statements) {
  try {
    const { error } = await supabase.rpc('exec', { query: statement });

    if (error) {
      // Try alternative method - direct query
      const { error: queryError } = await supabase.from('_migrations').select('*').limit(1);

      // If RPC doesn't exist, try executing via REST
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`
        },
        body: JSON.stringify({ query: statement })
      });

      if (!response.ok) {
        // Execute each statement individually using direct SQL
        const pgResponse = await fetch(`${supabaseUrl}/rest/v1/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseServiceKey,
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({ query: statement })
        });

        if (!pgResponse.ok) {
          console.error('✗ Error executing statement:', statement.substring(0, 80) + '...');
          console.error('  Error:', error?.message || 'Unknown error');
          errorCount++;
          continue;
        }
      }
    }

    console.log('✓ Executed:', statement.substring(0, 80).replace(/\s+/g, ' ') + '...');
    successCount++;
  } catch (err) {
    console.error('✗ Failed:', statement.substring(0, 80) + '...');
    console.error('  Error:', err.message);
    errorCount++;
  }
}

console.log('\n' + '='.repeat(50));
console.log(`Migration completed:`);
console.log(`  Success: ${successCount} statements`);
console.log(`  Errors: ${errorCount} statements`);
console.log('='.repeat(50));

if (errorCount === 0) {
  console.log('\n✓ Migration applied successfully!');
  process.exit(0);
} else {
  console.log('\n⚠ Migration completed with errors. Please check the output above.');
  process.exit(1);
}
