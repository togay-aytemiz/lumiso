import { useState } from "react";
import SettingsPageWrapper from "@/components/settings/SettingsPageWrapper";
import SettingsHeader from "@/components/settings/SettingsHeader";
import SettingsSection from "@/components/SettingsSection";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Notifications() {
  const [notifications, setNotifications] = useState({
    overdueReminders: true,
    deliveryDueSoon: true,
    deliveryDueSoonTime: "09:00",
    sessionStartsTomorrow: false,
    sessionStartsTomorrowTime: "08:00",
    dailyTaskSummary: true,
    dailyTaskSummaryTime: "07:00",
    missedTasks: false,
    integrationErrors: true,
    inviteAccepted: true,
  });

  const timeOptions = [
    { value: "07:00", label: "07:00" },
    { value: "08:00", label: "08:00" },
    { value: "09:00", label: "09:00" },
    { value: "10:00", label: "10:00" },
    { value: "11:00", label: "11:00" },
    { value: "12:00", label: "12:00" },
  ];

  const updateNotification = (key: string, value: boolean | string) => {
    setNotifications(prev => ({
      ...prev,
      [key]: value
    }));
  };

  return (
    <SettingsPageWrapper>
      <SettingsHeader
        title="Notifications"
        description="Configure when and how you receive notifications"
      />
      
      <div className="space-y-8">
        <SettingsSection
          title="Reminders & Deadlines"
          description="Notifications about upcoming or overdue items."
        >
          <div className="space-y-6">
            {/* Overdue Reminders */}
            <div className="flex items-center justify-between">
              <Label htmlFor="overdue-reminders" className="text-sm font-medium">
                Notify me when a reminder is overdue
              </Label>
              <Switch
                id="overdue-reminders"
                checked={notifications.overdueReminders}
                onCheckedChange={(checked) => updateNotification("overdueReminders", checked)}
              />
            </div>

            {/* Delivery Due Soon */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="delivery-due-soon" className="text-sm font-medium">
                  Notify me 1 day before a delivery deadline
                </Label>
                <Switch
                  id="delivery-due-soon"
                  checked={notifications.deliveryDueSoon}
                  onCheckedChange={(checked) => updateNotification("deliveryDueSoon", checked)}
                />
              </div>
              
              {notifications.deliveryDueSoon && (
                <div className="ml-4 flex items-center gap-3">
                  <Label htmlFor="delivery-time" className="text-sm text-muted-foreground">
                    Send at
                  </Label>
                  <Select
                    value={notifications.deliveryDueSoonTime}
                    onValueChange={(value) => updateNotification("deliveryDueSoonTime", value)}
                  >
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {timeOptions.map((time) => (
                        <SelectItem key={time.value} value={time.value}>
                          {time.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Session Starts Tomorrow */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="session-starts-tomorrow" className="text-sm font-medium">
                  Notify me 1 day before a scheduled session
                </Label>
                <Switch
                  id="session-starts-tomorrow"
                  checked={notifications.sessionStartsTomorrow}
                  onCheckedChange={(checked) => updateNotification("sessionStartsTomorrow", checked)}
                />
              </div>
              
              {notifications.sessionStartsTomorrow && (
                <div className="ml-4 flex items-center gap-3">
                  <Label htmlFor="session-time" className="text-sm text-muted-foreground">
                    Send at
                  </Label>
                  <Select
                    value={notifications.sessionStartsTomorrowTime}
                    onValueChange={(value) => updateNotification("sessionStartsTomorrowTime", value)}
                  >
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {timeOptions.map((time) => (
                        <SelectItem key={time.value} value={time.value}>
                          {time.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
        </SettingsSection>

        <SettingsSection
          title="Tasks & Todos"
          description="Stay on top of your daily task list."
        >
          <div className="space-y-6">
            {/* Daily Task Summary */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="daily-task-summary" className="text-sm font-medium">
                  Send me a summary of my tasks every morning
                </Label>
                <Switch
                  id="daily-task-summary"
                  checked={notifications.dailyTaskSummary}
                  onCheckedChange={(checked) => updateNotification("dailyTaskSummary", checked)}
                />
              </div>
              
              {notifications.dailyTaskSummary && (
                <div className="ml-4 flex items-center gap-3">
                  <Label htmlFor="task-summary-time" className="text-sm text-muted-foreground">
                    Send at
                  </Label>
                  <Select
                    value={notifications.dailyTaskSummaryTime}
                    onValueChange={(value) => updateNotification("dailyTaskSummaryTime", value)}
                  >
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {timeOptions.map((time) => (
                        <SelectItem key={time.value} value={time.value}>
                          {time.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Missed Tasks */}
            <div className="flex items-center justify-between">
              <Label htmlFor="missed-tasks" className="text-sm font-medium">
                Notify me about tasks I forgot to mark as done
              </Label>
              <Switch
                id="missed-tasks"
                checked={notifications.missedTasks}
                onCheckedChange={(checked) => updateNotification("missedTasks", checked)}
              />
            </div>
          </div>
        </SettingsSection>

        <SettingsSection
          title="System Alerts"
          description="Important updates about your account or integrations."
        >
          <div className="space-y-6">
            {/* Integration Errors */}
            <div className="flex items-center justify-between">
              <Label htmlFor="integration-errors" className="text-sm font-medium">
                Notify me if calendar or messaging integrations fail
              </Label>
              <Switch
                id="integration-errors"
                checked={notifications.integrationErrors}
                onCheckedChange={(checked) => updateNotification("integrationErrors", checked)}
              />
            </div>

            {/* Invite Accepted */}
            <div className="flex items-center justify-between">
              <Label htmlFor="invite-accepted" className="text-sm font-medium">
                Notify me when a team member accepts an invite
              </Label>
              <Switch
                id="invite-accepted"
                checked={notifications.inviteAccepted}
                onCheckedChange={(checked) => updateNotification("inviteAccepted", checked)}
              />
            </div>
          </div>
        </SettingsSection>
      </div>
    </SettingsPageWrapper>
  );
}