const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  try {
    // Check licenses
    const { data: licenses, error: licError } = await supabase
      .from('licenses')
      .select('*');
    console.log('📋 Licenses:', licenses?.length || 0);
    
    // Check profiles
    const { data: profiles, error: profError } = await supabase
      .from('profiles')
      .select('*');
    console.log('👤 Profiles:', profiles?.length || 0);
    
    // Check projects
    const { data: projects, error: projError } = await supabase
      .from('projects')
      .select('*');
    console.log('📁 Projects:', projects?.length || 0);
    
    // Check missions
    const { data: missions, error: missError } = await supabase
      .from('missions')
      .select('*');
    console.log('📊 Missions:', missions?.length || 0);
    
    // Check signals
    const { data: signals, error: sigError } = await supabase
      .from('signals')
      .select('*');
    console.log('🚨 Signals:', signals?.length || 0);
    
    if (missions && missions.length > 0) {
      console.log('\n📊 Mission details:');
      missions.forEach(m => {
        console.log(`  - ${m.id}: ${m.scenario} (${m.status})`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
})();
