import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useRoleTemplates } from '@/hooks/useRoleTemplates';
import { SimpleRoleTemplateCard } from '@/components/settings/SimpleRoleTemplateCard';
import { Trash2, Users, Sparkles, Crown, Settings as SettingsIcon, UserCheck, Eye } from 'lucide-react';
import SettingsPageWrapper from "@/components/settings/SettingsPageWrapper";
import SettingsHeader from "@/components/settings/SettingsHeader";
import { settingsHelpContent } from "@/lib/settingsHelpContent";

export default function SimpleRoles() {
  const { 
    roleTemplates,
    customRoles, 
    memberRoles, 
    loading, 
    createRoleFromTemplate, 
    assignRoleToMember,
    deleteCustomRole 
  } = useRoleTemplates();

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getMembersByRole = (roleId: string) => {
    return memberRoles.filter(member => member.custom_role_id === roleId);
  };

  const getRoleIcon = (templateName?: string) => {
    if (!templateName) return SettingsIcon;
    switch (templateName.toLowerCase()) {
      case 'full admin':
        return Crown;
      case 'project manager':
        return SettingsIcon;
      case 'team member':
        return UserCheck;
      case 'viewer':
        return Eye;
      default:
        return SettingsIcon;
    }
  };

  const getRoleBadgeVariant = (templateName?: string) => {
    if (!templateName) return 'secondary';
    switch (templateName.toLowerCase()) {
      case 'full admin':
        return 'default';
      case 'project manager':
        return 'default';
      case 'team member':
        return 'secondary';
      case 'viewer':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  return (
    <SettingsPageWrapper>
      <SettingsHeader
        title="Role Management"
        description="Assign roles to your team members using simple, preset role templates"
        helpContent={settingsHelpContent.roles}
      />
      
      <div className="space-y-8">
        {/* Role Templates */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">Available Role Templates</h2>
          </div>
          <p className="text-muted-foreground">
            Choose from these preset roles designed for photography businesses. Each role comes with carefully selected permissions.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {roleTemplates.map((template) => (
              <SimpleRoleTemplateCard
                key={template.id}
                template={template}
                onCreateRole={createRoleFromTemplate}
                loading={loading}
              />
            ))}
          </div>
        </div>

        {/* Active Roles */}
        {customRoles.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <SettingsIcon className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold">Active Roles</h2>
            </div>
            
            <div className="grid gap-4">
              {customRoles.map((role) => {
                const membersWithRole = getMembersByRole(role.id);
                const RoleIcon = getRoleIcon(role.template?.name);
                
                return (
                  <Card key={role.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-primary/10 rounded-lg">
                            <RoleIcon className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <CardTitle className="flex items-center gap-2">
                              {role.name}
                              <Badge variant="secondary" className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {membersWithRole.length}
                              </Badge>
                            </CardTitle>
                            <CardDescription className="flex items-center gap-2">
                              {role.description}
                              {role.template && (
                                <Badge variant="outline" className="text-xs">
                                  Based on {role.template.name}
                                </Badge>
                              )}
                            </CardDescription>
                          </div>
                        </div>
                        
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Role</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete "{role.name}"? 
                                This will remove the role from {membersWithRole.length} team member(s).
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteCustomRole(role.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                Delete Role
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </CardHeader>
                    
                    {membersWithRole.length > 0 && (
                      <CardContent>
                        <div>
                          <h4 className="font-medium text-sm mb-3 text-muted-foreground">Team Members</h4>
                          <div className="grid gap-2">
                            {membersWithRole.map((member) => (
                              <div key={member.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                                <Avatar className="h-8 w-8">
                                  <AvatarImage src={member.profile_photo_url} />
                                  <AvatarFallback className="text-xs">
                                    {getInitials(member.full_name)}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-sm font-medium">{member.full_name || 'Unnamed User'}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Team Members */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">Team Members</h2>
          </div>
          
          <div className="grid gap-3">
            {memberRoles.map((member) => {
              const memberRole = customRoles.find(role => role.id === member.custom_role_id);
              const RoleIcon = getRoleIcon(memberRole?.template?.name);
              
              return (
                <Card key={member.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={member.profile_photo_url} />
                          <AvatarFallback>
                            {getInitials(member.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        
                        <div>
                          <p className="font-medium">{member.full_name || 'Unnamed User'}</p>
                          <div className="flex items-center gap-2">
                            <Badge variant={member.system_role === 'Owner' ? 'default' : 'secondary'}>
                              {member.system_role}
                            </Badge>
                            {memberRole && (
                              <Badge variant={getRoleBadgeVariant(memberRole.template?.name)} className="flex items-center gap-1">
                                <RoleIcon className="h-3 w-3" />
                                {memberRole.name}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {member.system_role !== 'Owner' && (
                        <Select
                          value={member.custom_role_id || ''}
                          onValueChange={(value) => assignRoleToMember(member.id, value)}
                        >
                          <SelectTrigger className="w-48">
                            <SelectValue placeholder="Assign role" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">No role assigned</SelectItem>
                            {customRoles.map((role) => {
                              const RoleIcon = getRoleIcon(role.template?.name);
                              return (
                                <SelectItem key={role.id} value={role.id}>
                                  <div className="flex items-center gap-2">
                                    <RoleIcon className="h-4 w-4" />
                                    {role.name}
                                  </div>
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </SettingsPageWrapper>
  );
}