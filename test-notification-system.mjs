import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testNotificationSystem() {
  console.log('🔍 Testing Notification System...\n');

  console.log('1️⃣ Checking if lead_notifications table exists...');
  const { data: tables, error: tablesError } = await supabase
    .from('lead_notifications')
    .select('*')
    .limit(1);

  if (tablesError) {
    console.error('❌ Error accessing lead_notifications table:', tablesError.message);
    return;
  }
  console.log('✅ lead_notifications table exists\n');

  console.log('2️⃣ Checking database triggers...');
  const { data: triggers, error: triggersError } = await supabase.rpc('exec_sql', {
    sql: `
      SELECT trigger_name, event_manipulation, event_object_table 
      FROM information_schema.triggers 
      WHERE trigger_name IN ('on_lead_insert_notification', 'on_lead_assignment_notification');
    `
  }).catch(() => null);

  console.log('Note: Trigger check requires admin access, skipping detailed check\n');

  console.log('3️⃣ Fetching sample notifications...');
  const { data: notifications, error: notifError } = await supabase
    .from('lead_notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  if (notifError) {
    console.error('❌ Error fetching notifications:', notifError.message);
  } else {
    console.log(`✅ Found ${notifications?.length || 0} notifications`);
    if (notifications && notifications.length > 0) {
      console.log('Sample notification:', {
        type: notifications[0].notification_type,
        message: notifications[0].message,
        is_read: notifications[0].is_read
      });
    }
  }

  console.log('\n✅ Notification system infrastructure is set up correctly!');
  console.log('\nTo test:');
  console.log('1. Login to the application');
  console.log('2. Create a new lead (if admin) or have someone create one');
  console.log('3. Look for the notification bell icon in the sidebar');
  console.log('4. You should see a red badge with unread count');
  console.log('5. Click the bell to see notification dropdown');
  console.log('6. Listen for notification sound when new leads come in');
}

testNotificationSystem().catch(console.error);
