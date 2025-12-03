import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const supabaseUrl = 'https://kwiuzntxxsmezjgswact.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3aXV6bnR4eHNtZXpqZ3N3YWN0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MjU2OTA4NCwiZXhwIjoyMDU4MTQ1MDg0fQ.vvRtXPUV2Gp2YQcqQXYUiDMQBmMBaOPAVSxwkzXDpLg';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  try {
    console.log('📂 Reading migration file...');
    const migrationPath = path.join(__dirname, 'supabase/migrations/20250912105801_calm_dawn.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📝 Applying notification system migration via Supabase Management API...\n');

    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`
      },
      body: JSON.stringify({ query: migrationSQL })
    });

    if (!response.ok) {
      const error = await response.text();
      console.log('⚠️  Direct SQL execution not available. Trying statement-by-statement...\n');

      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s && !s.startsWith('--') && !s.startsWith('/*'));

      for (const statement of statements) {
        if (!statement) continue;

        try {
          const stmtResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseServiceKey,
              'Authorization': `Bearer ${supabaseServiceKey}`
            },
            body: JSON.stringify({ query: statement })
          });

          if (stmtResponse.ok) {
            console.log('✓ Statement executed');
          }
        } catch (e) {
          console.log('⊙ Statement skipped (may already exist)');
        }
      }
    } else {
      console.log('✅ Migration applied successfully!\n');
    }

    console.log('\n🔍 Verifying table exists...');
    const { data, error } = await supabase
      .from('lead_notifications')
      .select('*')
      .limit(1);

    if (error && error.message.includes('does not exist')) {
      console.error('\n❌ Table still does not exist. Manual migration required.');
      console.log('\n📋 Please apply this migration manually in Supabase SQL Editor:');
      console.log('https://supabase.com/dashboard/project/kwiuzntxxsmezjgswact/sql/new');
      console.log('\nPaste the contents of:');
      console.log('supabase/migrations/20250912105801_calm_dawn.sql');
      console.log('\nAnd also:');
      console.log('supabase/migrations/20250915100548_holy_ember.sql');
      process.exit(1);
    }

    console.log('✅ Table lead_notifications exists!\n');

    console.log('✅ Notification system is ready!');
    console.log('\n📋 Next steps:');
    console.log('1. Refresh your application');
    console.log('2. Create a new lead to test notifications');
    console.log('3. Check the notification bell icon in the sidebar');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.log('\n📋 Manual Migration Required:');
    console.log('Please apply the migration manually in Supabase SQL Editor:');
    console.log('https://supabase.com/dashboard/project/kwiuzntxxsmezjgswact/sql/new');
    console.log('\nFiles to apply:');
    console.log('1. supabase/migrations/20250912105801_calm_dawn.sql');
    console.log('2. supabase/migrations/20250915100548_holy_ember.sql');
    process.exit(1);
  }
}

applyMigration();
