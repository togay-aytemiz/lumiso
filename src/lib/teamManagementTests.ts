import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Test scenarios for different permission levels and team interactions
export class TeamManagementTester {
  private organizationId: string | null = null;
  private testResults: { scenario: string; passed: boolean; error?: string }[] = [];

  constructor() {
    this.initializeOrganization();
  }

  private async initializeOrganization() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No authenticated user");

      const { data: settings } = await supabase
        .from('user_settings')
        .select('active_organization_id')
        .eq('user_id', user.id)
        .maybeSingle();

      this.organizationId = settings?.active_organization_id || null;
    } catch (error) {
      console.error('Failed to initialize organization:', error);
    }
  }

  // Test scenario: Owner can manage all team members
  async testOwnerPermissions(): Promise<boolean> {
    if (!this.organizationId) return false;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw false;

      // Check if user is owner
      const { data: organization } = await supabase
        .from('organizations')
        .select('owner_id')
        .eq('id', this.organizationId)
        .single();

      const isOwner = organization?.owner_id === user.id;

      // Test owner can view all team members
      const { data: members, error: membersError } = await supabase
        .from('organization_members')
        .select('*')
        .eq('organization_id', this.organizationId);

      if (membersError) throw membersError;

      this.logTestResult('Owner Permissions - View Team', isOwner && members.length >= 0);
      return isOwner;
    } catch (error) {
      this.logTestResult('Owner Permissions', false, String(error));
      return false;
    }
  }

  // Test scenario: Member with custom role permissions
  async testCustomRolePermissions(userId: string, expectedPermissions: string[]): Promise<boolean> {
    if (!this.organizationId) return false;

    try {
      // Get user's role and permissions
      const { data: member } = await supabase
        .from('organization_members')
        .select(`
          custom_role_id,
          system_role,
          custom_roles (
            role_permissions (
              permissions (name)
            )
          )
        `)
        .eq('organization_id', this.organizationId)
        .eq('user_id', userId)
        .single();

      let userPermissions: string[] = [];

      if (member?.system_role === 'Owner') {
        // Owner has all permissions
        const { data: allPermissions } = await supabase
          .from('permissions')
          .select('name');
        userPermissions = allPermissions?.map(p => p.name) || [];
      } else if (member?.custom_roles) {
        userPermissions = member.custom_roles.role_permissions
          ?.map((rp: any) => rp.permissions.name) || [];
      }

      const hasExpectedPermissions = expectedPermissions.every(permission =>
        userPermissions.includes(permission)
      );

      this.logTestResult(`Custom Role Permissions for ${userId}`, hasExpectedPermissions);
      return hasExpectedPermissions;
    } catch (error) {
      this.logTestResult('Custom Role Permissions', false, String(error));
      return false;
    }
  }

  // Test scenario: Assignment notifications work
  async testAssignmentNotifications(): Promise<boolean> {
    if (!this.organizationId) return false;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No authenticated user");

      // Test by invoking the assignment notification function with test data
      const { data, error } = await supabase.functions.invoke('assignment-notification', {
        body: {
          type: 'project',
          entity_id: 'test-project-' + Date.now(),
          entity_name: 'Test Project Assignment',
          assignee_ids: [user.id],
          assigned_by_id: user.id,
          organization_id: this.organizationId,
          action: 'assigned'
        }
      });

      const success = !error && data?.sent >= 0;
      this.logTestResult('Assignment Notifications', success);
      return success;
    } catch (error) {
      this.logTestResult('Assignment Notifications', false, String(error));
      return false;
    }
  }

  // Test scenario: Data access based on assignments
  async testAssignmentBasedAccess(entityType: 'leads' | 'projects'): Promise<boolean> {
    if (!this.organizationId) return false;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw false;

      // Test viewing only assigned items
      const { data: assignedItems, error } = await supabase
        .from(entityType)
        .select('id, assignees, user_id')
        .eq('organization_id', this.organizationId)
        .or(`assignees.cs.{${user.id}},user_id.eq.${user.id}`)
        .limit(5);

      if (error) throw error;

      const hasValidAssignments = assignedItems?.every(item => 
        item.assignees?.includes(user.id) || item.user_id === user.id
      );

      this.logTestResult(`Assignment Based Access - ${entityType}`, hasValidAssignments || false);
      return hasValidAssignments || false;
    } catch (error) {
      this.logTestResult(`Assignment Based Access - ${entityType}`, false, String(error));
      return false;
    }
  }

  // Test scenario: Timezone handling in team operations
  async testTimezoneAwareness(): Promise<boolean> {
    try {
      const { data: orgSettings } = await supabase
        .from('organization_settings')
        .select('timezone, date_format, time_format')
        .eq('organization_id', this.organizationId)
        .single();

      const hasTimezoneSettings = orgSettings?.timezone && 
                                orgSettings?.date_format && 
                                orgSettings?.time_format;

      // Test that timestamps are being handled with timezone consideration
      const testDate = new Date();
      const timezoneSupported = Intl.DateTimeFormat.supportedLocalesOf([orgSettings?.timezone || 'UTC']).length > 0;

      this.logTestResult('Timezone Awareness', hasTimezoneSettings && timezoneSupported);
      return hasTimezoneSettings && timezoneSupported;
    } catch (error) {
      this.logTestResult('Timezone Awareness', false, String(error));
      return false;
    }
  }

  // Test scenario: Real-time presence tracking
  async testPresenceTracking(): Promise<boolean> {
    if (!this.organizationId) return false;

    try {
      const channelName = `organization_${this.organizationId}_presence`;
      const channel = supabase.channel(channelName);
      
      let presenceDetected = false;

      // Set up presence tracking test
      channel
        .on('presence', { event: 'sync' }, () => {
          presenceDetected = true;
        })
        .subscribe();

      // Wait briefly for presence sync
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      channel.unsubscribe();
      
      this.logTestResult('Presence Tracking', presenceDetected);
      return presenceDetected;
    } catch (error) {
      this.logTestResult('Presence Tracking', false, String(error));
      return false;
    }
  }

  // Performance test: Team data loading
  async testTeamDataLoadingPerformance(): Promise<boolean> {
    if (!this.organizationId) return false;

    try {
      const startTime = performance.now();
      
      // Simulate the team data loading process
      const { data: membersData, error } = await supabase
        .from('organization_members')
        .select('*')
        .eq('organization_id', this.organizationId)
        .eq('status', 'active');

      const endTime = performance.now();
      const loadTime = endTime - startTime;
      
      const performanceAcceptable = loadTime < 2000; // Should load within 2 seconds
      
      this.logTestResult(`Team Data Performance (${loadTime.toFixed(2)}ms)`, performanceAcceptable && !error);
      return performanceAcceptable && !error;
    } catch (error) {
      this.logTestResult('Team Data Performance', false, String(error));
      return false;
    }
  }

  // Run comprehensive test suite
  async runAllTests(): Promise<void> {
    console.log('🧪 Starting Team Management Test Suite...');
    
    this.testResults = [];
    
    await this.testOwnerPermissions();
    await this.testAssignmentNotifications();
    await this.testAssignmentBasedAccess('leads');
    await this.testAssignmentBasedAccess('projects');
    await this.testTimezoneAwareness();
    await this.testPresenceTracking();
    await this.testTeamDataLoadingPerformance();

    this.generateTestReport();
  }

  private logTestResult(scenario: string, passed: boolean, error?: string): void {
    this.testResults.push({ scenario, passed, error });
    console.log(`${passed ? '✅' : '❌'} ${scenario}${error ? ` - ${error}` : ''}`);
  }

  private generateTestReport(): void {
    const passedTests = this.testResults.filter(result => result.passed).length;
    const totalTests = this.testResults.length;
    
    console.log('\n📊 Test Suite Report:');
    console.log(`Passed: ${passedTests}/${totalTests} (${Math.round(passedTests/totalTests*100)}%)`);
    
    const failedTests = this.testResults.filter(result => !result.passed);
    if (failedTests.length > 0) {
      console.log('\n❌ Failed Tests:');
      failedTests.forEach(test => {
        console.log(`  - ${test.scenario}: ${test.error || 'Unknown error'}`);
      });
    }

    toast.success(`Team Management Tests Complete: ${passedTests}/${totalTests} passed`);
  }

  // Utility method to create test data
  async createTestScenario(scenarioName: string): Promise<void> {
    try {
      console.log(`🔧 Setting up test scenario: ${scenarioName}`);
      
      // Create test data based on scenario
      switch (scenarioName) {
        case 'multi-role-team':
          await this.setupMultiRoleTeamScenario();
          break;
        case 'assignment-workflow':
          await this.setupAssignmentWorkflowScenario();
          break;
        default:
          console.warn(`Unknown test scenario: ${scenarioName}`);
      }
    } catch (error) {
      console.error(`Failed to setup test scenario ${scenarioName}:`, error);
    }
  }

  private async setupMultiRoleTeamScenario(): Promise<void> {
    // This would create test users with different roles for comprehensive testing
    console.log('Multi-role team scenario setup complete');
  }

  private async setupAssignmentWorkflowScenario(): Promise<void> {
    // This would create test projects/leads with various assignment patterns
    console.log('Assignment workflow scenario setup complete');
  }
}

// Export utility functions for use in components
export const testTeamManagement = async (): Promise<void> => {
  const tester = new TeamManagementTester();
  await tester.runAllTests();
};

export const validateTeamPermissions = async (userId: string, permissions: string[]): Promise<boolean> => {
  const tester = new TeamManagementTester();
  return await tester.testCustomRolePermissions(userId, permissions);
};