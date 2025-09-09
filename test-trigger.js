// Manual test in browser console
// Copy and paste this into browser console to test workflow triggering

const testTrigger = async () => {
  console.log('🔧 Testing manual workflow trigger...');
  
  const sessionId = '07143e31-58d0-4e97-9e55-b5ff8b8dfe0d';
  const organizationId = '9c3e5bce-d804-4d1c-9d13-04c42d7d1f45';
  
  // Test UUID validation
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  console.log('✅ Session ID valid?', uuidRegex.test(sessionId));
  console.log('✅ Org ID valid?', uuidRegex.test(organizationId));
  
  try {
    // Direct supabase call to trigger workflow
    const { data, error } = await supabase.functions.invoke('workflow-executor', {
      body: {
        action: 'trigger',
        trigger_type: 'session_scheduled',
        trigger_entity_type: 'session', 
        trigger_entity_id: sessionId,
        organization_id: organizationId,
        trigger_data: {
          session_date: '2025-09-11',
          session_time: '15:00:00',
          client_name: 'Togay'
        }
      }
    });
    
    console.log('📡 Manual trigger result:', { data, error });
    
    if (error) {
      console.error('❌ Manual trigger failed:', error);
    } else {
      console.log('✅ Manual trigger succeeded!');
    }
  } catch (err) {
    console.error('❌ Exception during manual trigger:', err);
  }
};

testTrigger();