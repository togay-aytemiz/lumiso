import { useState, useRef } from "react";
import SettingsPageWrapper from "@/components/settings/SettingsPageWrapper";
import SettingsHeader from "@/components/settings/SettingsHeader";
import SettingsSection from "@/components/SettingsSection";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AppSheetModal } from "@/components/ui/app-sheet-modal";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Edit, Trash2, ChevronDown } from "lucide-react";

export default function ClientMessaging() {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingMessage, setEditingMessage] = useState<number | null>(null);
  const [deleteMessageId, setDeleteMessageId] = useState<number | null>(null);
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
      isActive: true,
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

  const variableOptions = [
    { label: "Client Name", value: "{client_name}" },
    { label: "Session Date", value: "{session_date}" },
    { label: "Payment Link", value: "{payment_link}" },
  ];

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
    setIsSheetOpen(false);
    setEditingMessage(null);
    setNewMessage({ trigger: "", channels: [], content: "" });
  };

  const handleEdit = (messageId: number) => {
    const message = messages.find(m => m.id === messageId);
    if (message) {
      setNewMessage({
        trigger: message.trigger,
        channels: message.channels,
        content: message.preview
      });
      setEditingMessage(messageId);
      setIsSheetOpen(true);
    }
  };

  const handleDelete = () => {
    // Static - no backend integration
    console.log("Deleting message:", deleteMessageId);
    setDeleteMessageId(null);
  };

  const handleCancel = () => {
    setIsSheetOpen(false);
    setEditingMessage(null);
    setNewMessage({ trigger: "", channels: [], content: "" });
  };

  const insertVariable = (variable: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentContent = newMessage.content;
    const newContent = currentContent.substring(0, start) + variable + currentContent.substring(end);
    
    setNewMessage(prev => ({ ...prev, content: newContent }));
    
    // Focus back to textarea and set cursor position
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + variable.length, start + variable.length);
    }, 0);
  };

  const toggleMessageActive = (messageId: number) => {
    // Static - no backend integration
    console.log("Toggling message active state:", messageId);
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
              <Button 
                className="flex items-center gap-2"
                onClick={() => setIsSheetOpen(true)}
              >
                <Plus className="h-4 w-4" />
                Add Message
              </Button>
            </div>

            {/* Messages Table */}
            {messages.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Active</TableHead>
                      <TableHead>Trigger</TableHead>
                      <TableHead>Channels</TableHead>
                      <TableHead>Message Preview</TableHead>
                      <TableHead className="w-24">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {messages.map((message) => (
                      <TableRow key={message.id} className={!message.isActive ? "opacity-60" : ""}>
                        <TableCell>
                          <Switch
                            checked={message.isActive}
                            onCheckedChange={() => toggleMessageActive(message.id)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {message.trigger}
                            {!message.isActive && (
                              <Badge variant="outline" className="text-xs text-muted-foreground">
                                Inactive
                              </Badge>
                            )}
                          </div>
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
                            <Button variant="ghost" size="sm" onClick={() => handleEdit(message.id)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" onClick={() => setDeleteMessageId(message.id)}>
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Message</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete this automated message? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel onClick={() => setDeleteMessageId(null)}>Cancel</AlertDialogCancel>
                                  <AlertDialogAction 
                                    onClick={handleDelete}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
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

        {/* App Sheet Modal for Add/Edit */}
        <AppSheetModal
          title={editingMessage ? "Edit Automated Message" : "Create Automated Message"}
          isOpen={isSheetOpen}
          onOpenChange={setIsSheetOpen}
          size="lg"
          footerActions={[
            { label: "Cancel", onClick: handleCancel, variant: "outline" },
            { label: editingMessage ? "Update Message" : "Save Message", onClick: handleSave }
          ]}
        >
          <div className="space-y-8 pt-4">
            {/* Basic Settings */}
            <div className="space-y-6">
              <h3 className="text-lg font-medium">Message Settings</h3>
              
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
                <div className="flex gap-2 flex-wrap">
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
            </div>

            {/* Message Content Section */}
            <div className="space-y-6">
              <h3 className="text-lg font-medium">Message Content</h3>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="content">Message Template</Label>
                  <Select onValueChange={insertVariable}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Insert Variable" />
                    </SelectTrigger>
                    <SelectContent>
                      {variableOptions.map((variable) => (
                        <SelectItem key={variable.value} value={variable.value}>
                          {variable.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Textarea
                  ref={textareaRef}
                  id="content"
                  placeholder="Enter your message template here..."
                  value={newMessage.content}
                  onChange={(e) => setNewMessage(prev => ({ ...prev, content: e.target.value }))}
                  rows={6}
                />
                <p className="text-sm text-muted-foreground">
                  Variables will be replaced with real values when the message is sent. Use the dropdown above to insert variables at your cursor position.
                </p>
              </div>
            </div>

            {/* Future Sections Placeholder */}
            <div className="space-y-4 pt-4 border-t border-border/50">
              <div className="text-sm text-muted-foreground">
                <p>Advanced settings like timing and conditional logic will be available in future updates.</p>
              </div>
            </div>
          </div>
        </AppSheetModal>
      </div>
    </SettingsPageWrapper>
  );
}