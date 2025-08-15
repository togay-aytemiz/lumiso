import { useState } from "react";
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
import { Upload, ChevronDown } from "lucide-react";

export default function Account() {
  const [workingHours, setWorkingHours] = useState({
    monday: { enabled: true, start: "09:00", end: "17:00" },
    tuesday: { enabled: true, start: "09:00", end: "17:00" },
    wednesday: { enabled: true, start: "09:00", end: "17:00" },
    thursday: { enabled: true, start: "09:00", end: "17:00" },
    friday: { enabled: true, start: "09:00", end: "17:00" },
    saturday: { enabled: false, start: "09:00", end: "17:00" },
    sunday: { enabled: false, start: "09:00", end: "17:00" },
  });

  const [inviteEmail, setInviteEmail] = useState("");

  const teamMembers = [
    { id: 1, name: "John Doe", email: "john@example.com", role: "Owner", isCurrentUser: true, lastActive: "Currently active", status: "active" },
    { id: 2, name: "Jane Smith", email: "jane@example.com", role: "Member", isCurrentUser: false, lastActive: "2 days ago", status: "active" },
  ];

  const pendingInvites = [
    { id: 3, email: "mike@example.com", status: "pending" },
  ];

  const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  const dayLabels = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  const updateWorkingHours = (day: string, field: string, value: any) => {
    setWorkingHours(prev => ({
      ...prev,
      [day]: { ...prev[day as keyof typeof prev], [field]: value }
    }));
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
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src="" />
                  <AvatarFallback>JD</AvatarFallback>
                </Avatar>
                <div className="flex flex-col gap-2">
                  <Button variant="outline" className="flex items-center gap-2">
                    <Upload className="h-4 w-4" />
                    Choose File
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    No file selected
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
                defaultValue="John Doe"
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
                defaultValue="+1 (555) 123-4567"
                className="max-w-md"
              />
            </div>

            {/* Email Address */}
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                defaultValue="john@example.com"
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
            {days.map((day, index) => (
              <div key={day} className="flex items-center gap-4 py-2">
                <div className="w-24">
                  <Label className="text-sm font-medium">{dayLabels[index]}</Label>
                </div>
                
                <div className="flex items-center gap-2">
                  <Switch
                    checked={workingHours[day as keyof typeof workingHours].enabled}
                    onCheckedChange={(enabled) => updateWorkingHours(day, "enabled", enabled)}
                  />
                </div>

                {workingHours[day as keyof typeof workingHours].enabled && (
                  <div className="flex items-center gap-2">
                    <Select
                      value={workingHours[day as keyof typeof workingHours].start}
                      onValueChange={(value) => updateWorkingHours(day, "start", value)}
                    >
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="08:00">08:00</SelectItem>
                        <SelectItem value="09:00">09:00</SelectItem>
                        <SelectItem value="10:00">10:00</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    <span className="text-sm text-muted-foreground">to</span>
                    
                    <Select
                      value={workingHours[day as keyof typeof workingHours].end}
                      onValueChange={(value) => updateWorkingHours(day, "end", value)}
                    >
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="16:00">16:00</SelectItem>
                        <SelectItem value="17:00">17:00</SelectItem>
                        <SelectItem value="18:00">18:00</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            ))}
          </div>
        </SettingsSection>

        <SettingsSection
          title="Team Management"
          description="Manage your team members and their roles."
        >
          <div className="space-y-6">
            {/* User List */}
            <div>
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
                  {teamMembers.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">
                        {member.name}
                        {member.isCurrentUser && (
                          <span className="text-sm text-muted-foreground ml-2">(You)</span>
                        )}
                      </TableCell>
                      <TableCell>{member.email}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-auto p-1 bg-secondary/50 hover:bg-secondary rounded-full"
                              disabled={member.isCurrentUser}
                            >
                              <Badge variant={member.role === "Owner" ? "default" : "secondary"} className="border-0 bg-transparent hover:bg-transparent">
                                {member.role}
                              </Badge>
                              {!member.isCurrentUser && <ChevronDown className="h-3 w-3 ml-1" />}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            <DropdownMenuItem onClick={() => {}}>Owner</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {}}>Member</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {member.lastActive}
                      </TableCell>
                      <TableCell>
                        {!member.isCurrentUser && (
                          <Button variant="outline" size="sm" className="text-destructive border-destructive/20 hover:bg-destructive/10">
                            Remove
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {pendingInvites.map((invite) => (
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
                        —
                      </TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" className="text-muted-foreground">
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
                <div className="flex gap-2 mt-2">
                  <Input
                    id="invite-email"
                    type="email"
                    placeholder="Enter email address"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="max-w-md"
                  />
                  <Button>Send Invite</Button>
                </div>
              </div>
              
              <p className="text-sm text-muted-foreground">
                No pending invites yet
              </p>
            </div>
          </div>
        </SettingsSection>
      </div>
    </SettingsPageWrapper>
  );
}