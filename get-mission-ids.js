const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const { data: missions } = await supabase
    .from('missions')
    .select('id, scenario, status, project_id')
    .eq('license_id', 'aa685129-dc86-49e6-9fa8-dc792efd5ade')
    .eq('status', 'analyzed')
    .limit(3);
  
  if (missions && missions.length > 0) {
    console.log('Sample analyzed missions:');
    missions.forEach(m => {
      console.log(`${m.id} - ${m.scenario} (project: ${m.project_id})`);
    });
    
    // Get a signal from the first mission
    const { data: signals } = await supabase
      .from('signals')
      .select('id')
      .eq('mission_id', missions[0].id)
      .limit(1);
    
    if (signals && signals.length > 0) {
      console.log(`\nSample signal: ${signals[0].id}`);
    }
  }
})();
