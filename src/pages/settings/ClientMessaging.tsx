import { useState } from "react";
import SettingsPageWrapper from "@/components/settings/SettingsPageWrapper";
import SettingsHeader from "@/components/settings/SettingsHeader";
import SettingsSection from "@/components/SettingsSection";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2 } from "lucide-react";

export default function ClientMessaging() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newMessage, setNewMessage] = useState({
    trigger: "",
    channels: [] as string[],
    content: ""
  });

  const messages = [
    {
      id: 1,
      trigger: "1 day before session",
      channels: ["WhatsApp", "Email"],
      preview: "Hi {client_name}, just a reminder that your session is tomorrow at...",
    }
  ];

  const triggerOptions = [
    "1 day before session",
    "On session date",
    "After album is ready",
    "3 days after unpaid invoice",
    "Custom trigger"
  ];

  const channelOptions = ["WhatsApp", "Email", "SMS"];

  const toggleChannel = (channel: string) => {
    setNewMessage(prev => ({
      ...prev,
      channels: prev.channels.includes(channel)
        ? prev.channels.filter(c => c !== channel)
        : [...prev.channels, channel]
    }));
  };

  const handleSave = () => {
    // Static - no backend integration
    console.log("Saving message:", newMessage);
    setIsDialogOpen(false);
    setNewMessage({ trigger: "", channels: [], content: "" });
  };

  return (
    <SettingsPageWrapper>
      <SettingsHeader
        title="Client Messaging"
        description="Manage automated message templates and delivery triggers for client communication"
      />
      
      <div className="space-y-8">
        <SettingsSection
          title="Automated Messages"
          description="Configure messages that are automatically sent to clients based on specific triggers."
        >
          <div className="space-y-4">
            {/* Add Message Button */}
            <div className="flex justify-end">
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Add Message
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[600px]">
                  <DialogHeader>
                    <DialogTitle>Create Automated Message</DialogTitle>
                  </DialogHeader>
                  
                  <div className="space-y-6">
                    {/* Trigger Selection */}
                    <div className="space-y-2">
                      <Label htmlFor="trigger">Trigger</Label>
                      <Select
                        value={newMessage.trigger}
                        onValueChange={(value) => setNewMessage(prev => ({ ...prev, trigger: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select when to send this message" />
                        </SelectTrigger>
                        <SelectContent>
                          {triggerOptions.map((trigger) => (
                            <SelectItem key={trigger} value={trigger}>
                              {trigger}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Channels Selection */}
                    <div className="space-y-2">
                      <Label>Channels</Label>
                      <div className="flex gap-2">
                        {channelOptions.map((channel) => (
                          <Button
                            key={channel}
                            variant={newMessage.channels.includes(channel) ? "default" : "outline"}
                            size="sm"
                            onClick={() => toggleChannel(channel)}
                            type="button"
                          >
                            {channel}
                          </Button>
                        ))}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Select one or more channels to send this message
                      </p>
                    </div>

                    {/* Message Content */}
                    <div className="space-y-2">
                      <Label htmlFor="content">Message Content</Label>
                      <Textarea
                        id="content"
                        placeholder="Enter your message template here..."
                        value={newMessage.content}
                        onChange={(e) => setNewMessage(prev => ({ ...prev, content: e.target.value }))}
                        rows={4}
                      />
                      <p className="text-sm text-muted-foreground">
                        Use variables like {"{client_name}"}, {"{session_date}"}, {"{payment_link}"} for dynamic content
                      </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleSave}>
                        Save Message
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* Messages Table */}
            {messages.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Trigger</TableHead>
                      <TableHead>Channels</TableHead>
                      <TableHead>Message Preview</TableHead>
                      <TableHead className="w-24">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {messages.map((message) => (
                      <TableRow key={message.id}>
                        <TableCell className="font-medium">
                          {message.trigger}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {message.channels.map((channel) => (
                              <Badge key={channel} variant="secondary" className="text-xs">
                                {channel}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <p className="text-sm text-muted-foreground truncate">
                            {message.preview}
                          </p>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <p className="text-lg font-medium">No automated messages yet</p>
                <p className="text-sm mt-1">
                  Create your first automated message to start communicating with clients
                </p>
              </div>
            )}
          </div>
        </SettingsSection>
      </div>
    </SettingsPageWrapper>
  );
}