import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import SettingsPageWrapper from "@/components/settings/SettingsPageWrapper";
import SettingsHeader from "@/components/settings/SettingsHeader";
import EnhancedSettingsSection from "@/components/settings/EnhancedSettingsSection";
import { CategorySettingsSection } from "@/components/settings/CategorySettingsSection";
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
import { useSettingsCategorySection } from "@/hooks/useSettingsCategorySection";
import { trimAndNormalizeSpaces, createTrimmedBlurHandler } from "@/lib/inputUtils";

export default function Account() {
  const [inviteEmail, setInviteEmail] = useState("");
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

  // Profile section state
  const profileSection = useSettingsCategorySection({
    sectionId: "profile",
    sectionName: "Profile",
    initialValues: {
      fullName: profile?.full_name || "",
      phoneNumber: profile?.phone_number || "",
    },
    onSave: async (values) => {
      const result = await updateProfile({
        full_name: trimAndNormalizeSpaces(values.fullName),
        phone_number: trimAndNormalizeSpaces(values.phoneNumber),
      });
      
      if (!result.success) {
        throw new Error("Failed to save profile");
      }
    }
  });

  // Working hours section state
  const workingHoursSection = useSettingsCategorySection({
    sectionId: "working-hours",
    sectionName: "Working Hours",
    initialValues: {
      workingHours: workingHours
    },
    onSave: async (values) => {
      // Working hours are saved immediately on change, so nothing to do here
      return values;
    }
  });

  const days = [1, 2, 3, 4, 5, 6, 0]; // Monday=1, Sunday=0
  const dayLabels = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  // Get current user info
  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email) setEmailAddress(user.email);
    return user;
  };

  // Load profile data when component mounts
  useEffect(() => {
    getCurrentUser();
  }, []);

  // Update form fields when profile loads
  useEffect(() => {
    if (profile && !profileLoading) {
      profileSection.setValues({
        fullName: profile.full_name || "",
        phoneNumber: profile.phone_number || "",
      });
    }
  }, [profile, profileLoading]);

  // Update working hours form when data loads
  useEffect(() => {
    console.log("Working hours data:", workingHours);
    if (workingHours.length > 0) {
      workingHoursSection.setValues({
        workingHours: workingHours
      });
    }
  }, [workingHours]);

  const handleWorkingHourUpdate = async (dayOfWeek: number, field: string, value: any) => {
    console.log(`Updating working hour for day ${dayOfWeek}, field ${field}, value ${value}`);
    const workingHour = workingHours.find(wh => wh.day_of_week === dayOfWeek);
    if (workingHour) {
      const result = await updateWorkingHour(dayOfWeek, { [field]: value });
      if (result.success) {
        toast({
          title: "Success",
          description: "Working hours updated successfully",
        });
      }
      // Mark working hours section as dirty to show save button
      workingHoursSection.updateValue("workingHours", workingHours);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      await uploadProfilePhoto(file);
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
    const workingHour = workingHours.find(wh => wh.day_of_week === dayOfWeek);
    if (workingHour) {
      return {
        ...workingHour,
        // Convert "09:00:00" to "09:00"
        start_time: workingHour.start_time ? workingHour.start_time.substring(0, 5) : "09:00",
        end_time: workingHour.end_time ? workingHour.end_time.substring(0, 5) : "17:00"
      };
    }
    return {
      enabled: false,
      start_time: "09:00",
      end_time: "17:00"
    };
  };

  // Get current user ID for comparison
  const getCurrentUserId = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id;
  };

  // Generate time options from 09:00 to 17:00
  const generateTimeOptions = () => {
    const times = [];
    for (let hour = 9; hour <= 17; hour++) {
      const timeString = `${hour.toString().padStart(2, '0')}:00`;
      times.push(timeString);
    }
    return times;
  };

  const timeOptions = generateTimeOptions();

  return (
    <SettingsPageWrapper>
      <SettingsHeader
        title="Account & Users"
        description="Manage your account settings and user permissions"
      />
      
      <div className="space-y-8">
        <CategorySettingsSection
          title="Profile"
          description="Update your personal information and photo."
          sectionId="profile"
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
                value={profileSection.values.fullName}
                onChange={(e) => profileSection.updateValue("fullName", e.target.value)}
                onBlur={createTrimmedBlurHandler(profileSection.values.fullName, (value) => profileSection.updateValue("fullName", value))}
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
                value={profileSection.values.phoneNumber}
                onChange={(e) => profileSection.updateValue("phoneNumber", e.target.value)}
                onBlur={createTrimmedBlurHandler(profileSection.values.phoneNumber, (value) => profileSection.updateValue("phoneNumber", value))}
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
        </CategorySettingsSection>

        <CategorySettingsSection
          title="Working Hours"
          description="Define your available times for bookings and scheduling."
          sectionId="working-hours"
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
                          {timeOptions.map(time => (
                            <SelectItem key={time} value={time}>{time}</SelectItem>
                          ))}
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
                          {timeOptions.map(time => (
                            <SelectItem key={time} value={time}>{time}</SelectItem>
                          ))}
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
                            {timeOptions.map(time => (
                              <SelectItem key={time} value={time}>{time}</SelectItem>
                            ))}
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
                            {timeOptions.map(time => (
                              <SelectItem key={time} value={time}>{time}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CategorySettingsSection>

        <EnhancedSettingsSection
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
                    const displayName = currentUser && profileSection.values.fullName 
                      ? profileSection.values.fullName 
                      : currentUser && profile?.full_name 
                      ? profile.full_name
                      : `User ${member.user_id.slice(0, 8)}...`;
                    
                    return (
                      <TableRow key={member.id}>
                        <TableCell className="font-medium">
                          {displayName}
                          {currentUser && (
                            <span className="text-sm text-muted-foreground ml-2">(You)</span>
                          )}
                        </TableCell>
                        <TableCell>{emailAddress && currentUser ? emailAddress : `${member.user_id.slice(0, 8)}...@example.com`}</TableCell>
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
                          {currentUser ? "Online" : member.last_active ? new Date(member.last_active).toLocaleDateString() : "Never"}
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
                    onBlur={createTrimmedBlurHandler(inviteEmail, setInviteEmail)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSendInvitation();
                      }
                    }}
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
        </EnhancedSettingsSection>
      </div>
    </SettingsPageWrapper>
  );
}