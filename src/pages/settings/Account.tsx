import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import SettingsPageWrapper from "@/components/settings/SettingsPageWrapper";
import SettingsHeader from "@/components/settings/SettingsHeader";
import SettingsSection from "@/components/SettingsSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Upload, ChevronDown, Loader2 } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { useWorkingHours } from "@/hooks/useWorkingHours";
import { useTeamManagement } from "@/hooks/useTeamManagement";
import { useToast } from "@/hooks/use-toast";

export default function Account() {
  const [inviteEmail, setInviteEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [emailAddress, setEmailAddress] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { profile, loading: profileLoading, uploading, updateProfile, uploadProfilePhoto } = useProfile();
  const { workingHours, loading: workingHoursLoading, updateWorkingHour } = useWorkingHours();
  const { 
    teamMembers, 
    invitations, 
    loading: teamLoading, 
    currentUserRole,
    sendInvitation, 
    cancelInvitation, 
    removeMember, 
    updateMemberRole 
  } = useTeamManagement();
  const { toast } = useToast();

  const days = [1, 2, 3, 4, 5, 6, 0]; // Monday=1, Sunday=0
  const dayLabels = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  // Get current user info
  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email) setEmailAddress(user.email);
    return user;
  };

  // Load profile data when component mounts
  useState(() => {
    getCurrentUser();
  });

  // Update form fields when profile loads
  useState(() => {
    if (profile) {
      setFullName(profile.full_name || "");
      setPhoneNumber(profile.phone_number || "");
    }
  });

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      await uploadProfilePhoto(file);
    }
  };

  const handleProfileSave = async () => {
    const result = await updateProfile({
      full_name: fullName,
      phone_number: phoneNumber,
    });
    
    if (result.success) {
      toast({
        title: "Success",
        description: "Profile updated successfully",
      });
    }
  };

  const handleWorkingHourUpdate = async (dayOfWeek: number, field: string, value: any) => {
    const workingHour = workingHours.find(wh => wh.day_of_week === dayOfWeek);
    if (workingHour) {
      await updateWorkingHour(dayOfWeek, { [field]: value });
    }
  };

  const handleSendInvitation = async () => {
    if (!inviteEmail.trim()) return;
    
    const result = await sendInvitation(inviteEmail, "Member");
    if (result.success) {
      setInviteEmail("");
    }
  };

  const getWorkingHourByDay = (dayOfWeek: number) => {
    return workingHours.find(wh => wh.day_of_week === dayOfWeek) || {
      enabled: false,
      start_time: "09:00",
      end_time: "17:00"
    };
  };

  return (
    <SettingsPageWrapper>
      <SettingsHeader
        title="Account & Users"
        description="Manage your account settings and user permissions"
      />
      
      <div className="space-y-8">
        <SettingsSection
          title="Profile"
          description="Update your personal information and photo."
        >
          <div className="space-y-6">
            {/* Avatar Upload */}
            <div className="space-y-2">
              <Label htmlFor="avatar-upload">Profile Photo</Label>
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={profile?.profile_photo_url || ""} />
                  <AvatarFallback>
                    {profile?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col gap-2 min-w-0 flex-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <Button 
                    variant="outline" 
                    className="flex items-center gap-2 w-full sm:w-fit"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    {uploading ? "Uploading..." : "Choose File"}
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {profile?.profile_photo_url ? "Photo uploaded" : "No file selected"}
                  </span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Used in admin views and client messages. Accepts JPG, PNG, SVG. Max file size: 2 MB
              </p>
            </div>

            {/* Full Name */}
            <div className="space-y-2">
              <Label htmlFor="full-name">Full Name</Label>
              <Input
                id="full-name"
                placeholder="Enter your full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                onBlur={handleProfileSave}
                className="max-w-md"
              />
            </div>

            {/* Phone Number */}
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="Enter your phone number"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                onBlur={handleProfileSave}
                className="max-w-md"
              />
            </div>

            {/* Email Address */}
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={emailAddress}
                disabled
                className="max-w-md"
              />
              <p className="text-sm text-muted-foreground">
                Contact support to change your email address
              </p>
            </div>
          </div>
        </SettingsSection>

        <SettingsSection
          title="Working Hours"
          description="Define your available times for bookings and scheduling."
        >
          <div className="space-y-4">
            {days.map((dayOfWeek, index) => {
              const workingHour = getWorkingHourByDay(dayOfWeek);
              return (
                <div key={dayOfWeek} className="space-y-2 sm:space-y-0">
                  {/* Desktop layout: single row */}
                  <div className="hidden sm:flex sm:items-center sm:gap-4 py-2">
                    <Switch
                      checked={workingHour.enabled}
                      onCheckedChange={(enabled) => handleWorkingHourUpdate(dayOfWeek, "enabled", enabled)}
                    />
                    <Label className="text-sm font-medium min-w-[80px]">{dayLabels[index]}</Label>
                    
                    <div className="flex items-center gap-3">
                      <Select
                        value={workingHour.start_time || "09:00"}
                        onValueChange={(value) => handleWorkingHourUpdate(dayOfWeek, "start_time", value)}
                        disabled={!workingHour.enabled}
                      >
                        <SelectTrigger className="w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="08:00">08:00</SelectItem>
                          <SelectItem value="09:00">09:00</SelectItem>
                          <SelectItem value="10:00">10:00</SelectItem>
                          <SelectItem value="11:00">11:00</SelectItem>
                          <SelectItem value="12:00">12:00</SelectItem>
                        </SelectContent>
                      </Select>
                      
                      <span className="text-sm text-muted-foreground">to</span>
                      
                      <Select
                        value={workingHour.end_time || "17:00"}
                        onValueChange={(value) => handleWorkingHourUpdate(dayOfWeek, "end_time", value)}
                        disabled={!workingHour.enabled}
                      >
                        <SelectTrigger className="w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="16:00">16:00</SelectItem>
                          <SelectItem value="17:00">17:00</SelectItem>
                          <SelectItem value="18:00">18:00</SelectItem>
                          <SelectItem value="19:00">19:00</SelectItem>
                          <SelectItem value="20:00">20:00</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Mobile layout: stacked */}
                  <div className="sm:hidden space-y-2 py-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">{dayLabels[index]}</Label>
                      <Switch
                        checked={workingHour.enabled}
                        onCheckedChange={(enabled) => handleWorkingHourUpdate(dayOfWeek, "enabled", enabled)}
                      />
                    </div>
                    
                    {workingHour.enabled && (
                      <div className="flex items-center gap-2">
                        <Select
                          value={workingHour.start_time || "09:00"}
                          onValueChange={(value) => handleWorkingHourUpdate(dayOfWeek, "start_time", value)}
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="08:00">08:00</SelectItem>
                            <SelectItem value="09:00">09:00</SelectItem>
                            <SelectItem value="10:00">10:00</SelectItem>
                            <SelectItem value="11:00">11:00</SelectItem>
                            <SelectItem value="12:00">12:00</SelectItem>
                          </SelectContent>
                        </Select>
                        
                        <Select
                          value={workingHour.end_time || "17:00"}
                          onValueChange={(value) => handleWorkingHourUpdate(dayOfWeek, "end_time", value)}
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="16:00">16:00</SelectItem>
                            <SelectItem value="17:00">17:00</SelectItem>
                            <SelectItem value="18:00">18:00</SelectItem>
                            <SelectItem value="19:00">19:00</SelectItem>
                            <SelectItem value="20:00">20:00</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </SettingsSection>

        <SettingsSection
          title="Team Management"
          description="Manage your team members and their roles."
        >
          <div className="space-y-6">
            {/* User List */}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Last Active</TableHead>
                    <TableHead className="w-24"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamMembers.map((member) => {
                    const currentUser = member.user_id === member.organization_id;
                    return (
                      <TableRow key={member.id}>
                        <TableCell className="font-medium">
                          {member.user_id}
                          {currentUser && (
                            <span className="text-sm text-muted-foreground ml-2">(You)</span>
                          )}
                        </TableCell>
                        <TableCell>{member.user_id}</TableCell>
                        <TableCell>
                          {currentUser || currentUserRole !== "Owner" ? (
                            <Badge variant={member.role === "Owner" ? "default" : "secondary"}>
                              {member.role}
                            </Badge>
                          ) : (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-auto p-1 bg-secondary/50 hover:bg-secondary rounded-full"
                                >
                                  <Badge variant={member.role === "Owner" ? "default" : "secondary"} className="border-0 bg-transparent hover:bg-transparent">
                                    {member.role}
                                  </Badge>
                                  <ChevronDown className="h-3 w-3 ml-1" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start">
                                <DropdownMenuItem onClick={() => updateMemberRole(member.id, "Owner")}>
                                  Owner
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => updateMemberRole(member.id, "Member")}>
                                  Member
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {member.last_active ? new Date(member.last_active).toLocaleDateString() : "Never"}
                        </TableCell>
                        <TableCell>
                          {!currentUser && currentUserRole === "Owner" && (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="text-destructive border-destructive/20 hover:bg-destructive/10"
                              onClick={() => removeMember(member.id)}
                            >
                              Remove
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {invitations.map((invite) => (
                    <TableRow key={invite.id}>
                      <TableCell className="font-medium text-muted-foreground">
                        Pending invite
                      </TableCell>
                      <TableCell>{invite.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-muted-foreground">
                          Pending
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(invite.expires_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="text-muted-foreground"
                          onClick={() => cancelInvitation(invite.id)}
                        >
                          Cancel Invite
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Invite New Member */}
            <div className="space-y-4 pt-4 border-t">
              <div>
                <Label htmlFor="invite-email">Invite New Member</Label>
                <div className="flex flex-col sm:flex-row gap-2 mt-2">
                  <Input
                    id="invite-email"
                    type="email"
                    placeholder="Enter email address"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="flex-1 min-w-0"
                  />
                  <Button 
                    className="shrink-0 sm:w-auto"
                    onClick={handleSendInvitation}
                    disabled={!inviteEmail.trim() || currentUserRole !== "Owner"}
                  >
                    Send Invite
                  </Button>
                </div>
              </div>
              
              {invitations.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No pending invites yet
                </p>
              )}
            </div>
          </div>
        </SettingsSection>
      </div>
    </SettingsPageWrapper>
  );
}