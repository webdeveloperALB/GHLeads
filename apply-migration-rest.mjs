import { readFileSync } from 'fs';

const supabaseUrl = 'https://kwiuzntxxsmezjgswact.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3aXV6bnR4eHNtZXpqZ3N3YWN0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MjU2OTA4NCwiZXhwIjoyMDU4MTQ1MDg0fQ.vvRtXPUV2Gp2YQcqQXYUiDMQBmMBaOPAVSxwkzXDpLg';

const migrationSql = readFileSync('./supabase/migrations/20251024145322_auto_assignment_rules.sql', 'utf8');

console.log('Applying migration via Supabase Management API...\n');

async function applyMigration() {
  try {
    // Use Supabase Management API to run SQL
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        query: migrationSql
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    console.log('✓ Migration applied successfully!');

    // Verify the table was created
    const verifyResponse = await fetch(`${supabaseUrl}/rest/v1/lead_assignment_rules?select=*&limit=0`, {
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`
      }
    });

    if (verifyResponse.ok) {
      console.log('✓ Table verified: lead_assignment_rules exists');
    } else {
      console.log('⚠ Could not verify table creation');
    }

  } catch (error) {
    console.error('Error:', error.message);
    console.log('\nPlease apply the migration manually through Supabase Dashboard:');
    console.log('1. Go to https://supabase.com/dashboard/project/kwiuzntxxsmezjgswact/sql');
    console.log('2. Copy the SQL from: supabase/migrations/20251024145322_auto_assignment_rules.sql');
    console.log('3. Paste and run it in the SQL Editor');
    process.exit(1);
  }
}

applyMigration();
