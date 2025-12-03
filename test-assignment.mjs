import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

console.log('Supabase URL:', supabaseUrl);
console.log('Service Key exists:', !!supabaseKey);

const supabase = createClient(supabaseUrl, supabaseKey);

const testSource = 'test234423432';
const testCountry = 'IT';

console.log('\n🔍 Testing assignment logic...');
console.log('Looking for rules with:');
console.log('  Source:', testSource);
console.log('  Country:', testCountry);

const { data: matchingRules, error: ruleError } = await supabase
  .from('lead_assignment_rules')
  .select('*, assigned_agent:user_profiles!lead_assignment_rules_assigned_agent_id_fkey(id, full_name)')
  .eq('source_name', testSource)
  .eq('country_code', testCountry)
  .eq('is_active', true)
  .order('priority', { ascending: false })
  .limit(1);

if (ruleError) {
  console.error('\n❌ Error querying rules:', ruleError);
} else {
  console.log('\n✅ Query successful');
  console.log('Rules found:', matchingRules?.length || 0);
  if (matchingRules && matchingRules.length > 0) {
    console.log('\nMatching rule:');
    console.log(JSON.stringify(matchingRules[0], null, 2));
  } else {
    console.log('\n⚠️  No matching rules found');

    console.log('\nChecking all active rules...');
    const { data: allRules } = await supabase
      .from('lead_assignment_rules')
      .select('*')
      .eq('is_active', true);

    if (allRules && allRules.length > 0) {
      console.log('\nAll active rules:');
      console.table(allRules.map(r => ({
        source_name: r.source_name,
        country_code: r.country_code,
        priority: r.priority,
        is_active: r.is_active
      })));
    } else {
      console.log('No active rules exist in the database');
    }
  }
}
