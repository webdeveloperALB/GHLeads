import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const connectionString = 'postgresql://postgres.kwiuzntxxsmezjgswact:dh2h3CIJFoP5NKYJ@aws-0-eu-central-1.pooler.supabase.com:5432/postgres';

const client = new Client({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

async function applyMigration() {
  try {
    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected successfully!\n');

    console.log('📂 Reading migration file...');
    const migrationPath = path.join(__dirname, 'supabase/migrations/20250912105801_calm_dawn.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📝 Applying notification system migration...\n');

    await client.query(migrationSQL);

    console.log('✅ Migration applied successfully!\n');

    console.log('🔍 Verifying table structure...');
    const result = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'lead_notifications'
      ORDER BY ordinal_position
    `);

    if (result.rows.length === 0) {
      console.error('❌ Table lead_notifications was not created!');
      process.exit(1);
    }

    console.log('\n📊 Table: lead_notifications');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type} ${row.is_nullable === 'NO' ? '(NOT NULL)' : ''}`);
    });

    console.log('\n🔍 Checking triggers...');
    const triggers = await client.query(`
      SELECT trigger_name, event_manipulation, event_object_table
      FROM information_schema.triggers
      WHERE trigger_name IN ('on_lead_insert_notification', 'on_lead_assignment_notification')
    `);

    if (triggers.rows.length > 0) {
      console.log('\n🎯 Triggers:');
      triggers.rows.forEach(row => {
        console.log(`  - ${row.trigger_name} on ${row.event_object_table} (${row.event_manipulation})`);
      });
    } else {
      console.log('⚠️  No triggers found - this might be expected if they were created differently');
    }

    console.log('\n✅ Notification system is ready!');
    console.log('\n📋 Next steps:');
    console.log('1. Refresh your application');
    console.log('2. Create a new lead to test notifications');
    console.log('3. Check the notification bell icon in the sidebar');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigration();
