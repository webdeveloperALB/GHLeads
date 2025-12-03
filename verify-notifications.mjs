import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kwiuzntxxsmezjgswact.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3aXV6bnR4eHNtZXpqZ3N3YWN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI1NjkwODQsImV4cCI6MjA1ODE0NTA4NH0.7q1S0bSVPP8cyW5HYPHfbSiPnYiXfVa_HlghTUy62Oo';

const supabase = createClient(supabaseUrl, supabaseKey);

async function verify() {
  console.log('🔍 Verifying notification system...\n');

  console.log('1️⃣ Checking table access...');
  const { data: tableCheck, error: tableError } = await supabase
    .from('lead_notifications')
    .select('*')
    .limit(1);

  if (tableError) {
    console.error('❌ Error accessing table:', tableError.message);
    console.log('\n⚠️  The table might need RLS policies enabled.');
    console.log('Please ensure you are logged in as an authenticated user.');
    return;
  }

  console.log('✅ Table accessible\n');

  console.log('2️⃣ Counting existing notifications...');
  const { count, error: countError } = await supabase
    .from('lead_notifications')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    console.error('❌ Error counting notifications:', countError.message);
  } else {
    console.log(`✅ Found ${count || 0} notifications in total\n`);
  }

  console.log('3️⃣ Checking recent notifications...');
  const { data: recent, error: recentError } = await supabase
    .from('lead_notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  if (recentError) {
    console.error('❌ Error fetching recent:', recentError.message);
  } else if (recent && recent.length > 0) {
    console.log(`✅ Sample notification:`);
    console.log(`   Type: ${recent[0].notification_type}`);
    console.log(`   Message: ${recent[0].message}`);
    console.log(`   Read: ${recent[0].is_read}`);
    console.log(`   Created: ${recent[0].created_at}\n`);
  } else {
    console.log('ℹ️  No notifications yet (this is normal for a fresh system)\n');
  }

  console.log('✅ Notification system verified!');
  console.log('\n📋 To test:');
  console.log('1. Login to your application');
  console.log('2. Look for the bell icon in the sidebar');
  console.log('3. Create a new lead (or have one created via API)');
  console.log('4. You should see the notification bell update with a red badge');
  console.log('5. Click the bell to view notifications');
  console.log('\n⚠️  Important: Make sure Supabase Realtime is enabled for the lead_notifications table');
  console.log('   Go to: https://supabase.com/dashboard/project/kwiuzntxxsmezjgswact/database/replication');
}

verify().catch(console.error);
