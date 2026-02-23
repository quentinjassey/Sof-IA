const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  try {
    // Get all licenses with their profiles and projects
    const { data: licenses } = await supabase
      .from('licenses')
      .select('*');
    
    console.log('📋 Licenses:');
    for (const license of licenses || []) {
      console.log(`\n  🔑 ${license.license_key} (${license.id})`);
      
      // Get profiles for this license
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .eq('license_id', license.id);
      
      console.log(`     👤 Profiles: ${profiles?.length || 0}`);
      profiles?.forEach(p => console.log(`        - ${p.name} (CNCC-${p.cncc_number})`));
      
      // Get projects for this license
      const { data: projects } = await supabase
        .from('projects')
        .select('id, name, created_at')
        .eq('license_id', license.id);
      
      console.log(`     📁 Projects: ${projects?.length || 0}`);
      projects?.forEach(p => console.log(`        - ${p.name} (${p.id})`));
      
      // Get missions for this license
      const { data: missions } = await supabase
        .from('missions')
        .select('id, scenario, status')
        .eq('license_id', license.id);
      
      console.log(`     📊 Missions: ${missions?.length || 0}`);
      const analyzed = missions?.filter(m => m.status === 'analyzed').length || 0;
      console.log(`        - ${analyzed} analyzed`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
})();
