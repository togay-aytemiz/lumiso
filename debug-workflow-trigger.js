// Test script to manually trigger workflow
const testWorkflowTrigger = async () => {
  console.log('🔧 Testing workflow trigger manually...');
  
  // Test with the latest session
  const sessionId = '07143e31-58d0-4e97-9e55-b5ff8b8dfe0d'; // Latest Togay session
  const organizationId = 'test-org-id';
  
  try {
    // First test UUID validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    console.log('Session ID valid?', uuidRegex.test(sessionId));
    console.log('Org ID valid?', uuidRegex.test(organizationId));
    
    // Test the trigger
    const { triggerSessionScheduled } = useWorkflowTriggers();
    const result = await triggerSessionScheduled(sessionId, organizationId);
    console.log('✅ Manual trigger result:', result);
  } catch (error) {
    console.error('❌ Manual trigger failed:', error);
  }
};

// Call the test function
testWorkflowTrigger();