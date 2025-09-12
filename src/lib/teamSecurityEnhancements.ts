/**
 * Security enhancements for team management
 */

import { supabase } from "@/integrations/supabase/client";
import { validateEmail, validateAssignees } from "./validation";

export interface SecurityCheck {
  passed: boolean;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export class TeamSecurityValidator {
  
  /**
   * Validate team member invitation security
   */
  static async validateInvitationSecurity(email: string, role: string, organizationId: string): Promise<SecurityCheck[]> {
    const checks: SecurityCheck[] = [];
    
    // Check 1: Valid email format
    if (!validateEmail(email)) {
      checks.push({
        passed: false,
        message: "Invalid email format detected",
        severity: 'high'
      });
    }
    
    // Check 2: Domain whitelist (if configured)
    const emailDomain = email.split('@')[1];
    if (emailDomain && ['tempmail.org', '10minutemail.com', 'guerrillamail.com'].includes(emailDomain)) {
      checks.push({
        passed: false,
        message: "Temporary email domains are not allowed",
        severity: 'medium'
      });
    }
    
    // Check 3: Check for existing user conflicts
    try {
      const { data: existingMember } = await supabase
        .from('organization_members')
        .select('id, status')
        .eq('organization_id', organizationId)
        .eq('user_id', email) // This would need proper user lookup
        .maybeSingle();
        
      if (existingMember && existingMember.status === 'active') {
        checks.push({
          passed: false,
          message: "User is already a member of this organization",
          severity: 'medium'
        });
      }
    } catch (error) {
      checks.push({
        passed: false,
        message: "Unable to verify user membership status",
        severity: 'low'
      });
    }
    
    // Check 4: Role validation
    if (!['Owner', 'Member'].includes(role)) {
      checks.push({
        passed: false,
        message: "Invalid role specified",
        severity: 'high'
      });
    }
    
    return checks;
  }
  
  /**
   * Validate assignment security
   */
  static validateAssignmentSecurity(assigneeIds: string[], entityType: 'lead' | 'project'): SecurityCheck[] {
    const checks: SecurityCheck[] = [];
    
    // Check 1: Valid assignee IDs
    if (!validateAssignees(assigneeIds)) {
      checks.push({
        passed: false,
        message: "Invalid assignee IDs detected",
        severity: 'high'
      });
    }
    
    // Check 2: Assignment limits
    if (assigneeIds.length > 10) {
      checks.push({
        passed: false,
        message: `Too many assignees (${assigneeIds.length}). Maximum is 10.`,
        severity: 'medium'
      });
    }
    
    // Check 3: Duplicate assignments
    const uniqueAssignees = new Set(assigneeIds);
    if (uniqueAssignees.size !== assigneeIds.length) {
      checks.push({
        passed: false,
        message: "Duplicate assignees detected",
        severity: 'low'
      });
    }
    
    return checks;
  }
  
  /**
   * Validate role creation security
   */
  static validateRoleCreationSecurity(roleName: string, permissions: string[]): SecurityCheck[] {
    const checks: SecurityCheck[] = [];
    
    // Check 1: Role name validation
    if (roleName.length < 2) {
      checks.push({
        passed: false,
        message: "Role name too short",
        severity: 'medium'
      });
    }
    
    // Check 2: Dangerous permission combinations
    const dangerousPermissions = ['manage_all_leads', 'manage_all_projects', 'delete_leads', 'delete_projects'];
    const hasDangerousPerms = permissions.some(p => dangerousPermissions.includes(p));
    
    if (hasDangerousPerms && permissions.length > 5) {
      checks.push({
        passed: false,
        message: "Role has too many high-privilege permissions",
        severity: 'high'
      });
    }
    
    // Check 3: Minimum permissions
    if (permissions.length === 0) {
      checks.push({
        passed: false,
        message: "Role must have at least one permission",
        severity: 'medium'
      });
    }
    
    return checks;
  }
  
  /**
   * Check for suspicious activity patterns
   */
  static async detectSuspiciousActivity(organizationId: string): Promise<SecurityCheck[]> {
    const checks: SecurityCheck[] = [];
    
    try {
      // Check for rapid invitation pattern
      const { data: recentInvites } = await supabase
        .from('invitations')
        .select('created_at')
        .eq('organization_id', organizationId)
        .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()); // Last hour
      
      if (recentInvites && recentInvites.length > 5) {
        checks.push({
          passed: false,
          message: `Unusual invitation pattern detected: ${recentInvites.length} invitations in the last hour`,
          severity: 'medium'
        });
      }
      
      // Check for role escalation attempts
      const { data: roleChanges } = await supabase
        .from('organization_members')
        .select('updated_at, system_role')
        .eq('organization_id', organizationId)
        .gte('updated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
        .eq('system_role', 'Owner');
      
      if (roleChanges && roleChanges.length > 2) {
        checks.push({
          passed: false,
          message: `Multiple owner role assignments in last 24 hours: ${roleChanges.length}`,
          severity: 'high'
        });
      }
      
    } catch (error) {
      checks.push({
        passed: false,
        message: "Unable to complete security analysis",
        severity: 'low'
      });
    }
    
    return checks;
  }
  
  /**
   * Generate security report
   */
  static generateSecurityReport(checks: SecurityCheck[]): {
    overall: 'secure' | 'warning' | 'critical';
    criticalIssues: number;
    highIssues: number;
    mediumIssues: number;
    lowIssues: number;
    recommendations: string[];
  } {
    const critical = checks.filter(c => !c.passed && c.severity === 'critical').length;
    const high = checks.filter(c => !c.passed && c.severity === 'high').length;
    const medium = checks.filter(c => !c.passed && c.severity === 'medium').length;
    const low = checks.filter(c => !c.passed && c.severity === 'low').length;
    
    let overall: 'secure' | 'warning' | 'critical' = 'secure';
    if (critical > 0) overall = 'critical';
    else if (high > 0 || medium > 2) overall = 'warning';
    
    const recommendations: string[] = [];
    
    if (critical > 0) {
      recommendations.push('Immediate action required: Fix critical security issues');
    }
    if (high > 0) {
      recommendations.push('Review and address high-priority security concerns');
    }
    if (medium > 3) {
      recommendations.push('Consider implementing additional security measures');
    }
    if (overall === 'secure') {
      recommendations.push('Security status is good. Continue monitoring.');
    }
    
    return {
      overall,
      criticalIssues: critical,
      highIssues: high,
      mediumIssues: medium,
      lowIssues: low,
      recommendations
    };
  }
}