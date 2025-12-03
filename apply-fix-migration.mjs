import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf8');
const envVars = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    envVars[match[1]] = match[2];
  }
});

const supabaseUrl = envVars.VITE_SUPABASE_URL;
const supabaseKey = envVars.VITE_SUPABASE_SERVICE_ROLE_KEY;

const sql = fs.readFileSync('/tmp/fix_desk_notifications.sql', 'utf8');

try {
  console.log('Applying migration via REST API...');
  
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    },
    body: JSON.stringify({ sql_query: sql })
  });
  
  if (!response.ok) {
    const error = await response.text();
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
  
  const result = await response.json();
  console.log('✅ Migration applied successfully!', result);
} catch (err) {
  console.error('❌ Error:', err);
  process.exit(1);
}
