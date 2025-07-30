import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ArrowLeft, Bell, AlertTriangle, Clock, Calendar, CheckCircle, Circle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";

interface Activity {
  id: string;
  content: string;
  reminder_date: string;
  reminder_time: string;
  type: string;
  lead_id: string;
  created_at: string;
  completed?: boolean;
}

interface Lead {
  id: string;
  name: string;
  status: string;
}

type FilterType = 'overdue' | 'today' | 'tomorrow' | 'thisWeek' | 'nextWeek' | 'selectPeriod';

const ReminderDetails = () => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState<FilterType>('today');
  const navigate = useNavigate();

  useEffect(() => {
    fetchReminders();
  }, []);

  const fetchReminders = async () => {
    try {
      // Fetch activities with reminders
      const { data: activitiesData, error: activitiesError } = await supabase
        .from('activities')
        .select('*')
        .not('reminder_date', 'is', null)
        .order('reminder_date', { ascending: true });

      if (activitiesError) throw activitiesError;

      // Fetch lead names for the activities
      if (activitiesData && activitiesData.length > 0) {
        const leadIds = [...new Set(activitiesData.map(activity => activity.lead_id))];
        const { data: leadsData, error: leadsError } = await supabase
          .from('leads')
          .select('id, name, status')
          .in('id', leadIds);

        if (leadsError) throw leadsError;
        setLeads(leadsData || []);
      }

      setActivities(activitiesData || []);
    } catch (error: any) {
      toast({
        title: "Error fetching reminders",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getLeadName = (leadId: string) => {
    const lead = leads.find(l => l.id === leadId);
    return lead?.name || 'Unknown Lead';
  };

  const isOverdue = (reminderDate: string) => {
    const today = new Date();
    const reminder = new Date(reminderDate);
    today.setHours(0, 0, 0, 0);
    reminder.setHours(0, 0, 0, 0);
    return reminder.getTime() < today.getTime();
  };

  const isToday = (reminderDate: string) => {
    const today = new Date();
    const reminder = new Date(reminderDate);
    today.setHours(0, 0, 0, 0);
    reminder.setHours(0, 0, 0, 0);
    return reminder.getTime() === today.getTime();
  };

  const isTomorrow = (reminderDate: string) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const reminder = new Date(reminderDate);
    tomorrow.setHours(0, 0, 0, 0);
    reminder.setHours(0, 0, 0, 0);
    return reminder.getTime() === tomorrow.getTime();
  };

  const isThisWeek = (reminderDate: string) => {
    const today = new Date();
    const reminder = new Date(reminderDate);
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    
    startOfWeek.setHours(0, 0, 0, 0);
    endOfWeek.setHours(23, 59, 59, 999);
    reminder.setHours(0, 0, 0, 0);
    
    return reminder.getTime() >= startOfWeek.getTime() && reminder.getTime() <= endOfWeek.getTime();
  };

  const isNextWeek = (reminderDate: string) => {
    const today = new Date();
    const reminder = new Date(reminderDate);
    const startOfNextWeek = new Date(today);
    startOfNextWeek.setDate(today.getDate() - today.getDay() + 7);
    const endOfNextWeek = new Date(startOfNextWeek);
    endOfNextWeek.setDate(startOfNextWeek.getDate() + 6);
    
    startOfNextWeek.setHours(0, 0, 0, 0);
    endOfNextWeek.setHours(23, 59, 59, 999);
    reminder.setHours(0, 0, 0, 0);
    
    return reminder.getTime() >= startOfNextWeek.getTime() && reminder.getTime() <= endOfNextWeek.getTime();
  };

  const getFilteredActivities = () => {
    const overdueActivities = activities.filter(activity => isOverdue(activity.reminder_date));
    
    let filteredActivities: Activity[] = [];
    
    switch (selectedFilter) {
      case 'overdue':
        return overdueActivities;
      case 'today':
        filteredActivities = activities.filter(activity => isToday(activity.reminder_date));
        break;
      case 'tomorrow':
        filteredActivities = activities.filter(activity => isTomorrow(activity.reminder_date));
        break;
      case 'thisWeek':
        filteredActivities = activities.filter(activity => isThisWeek(activity.reminder_date));
        break;
      case 'nextWeek':
        filteredActivities = activities.filter(activity => isNextWeek(activity.reminder_date));
        break;
      case 'selectPeriod':
      default:
        filteredActivities = activities;
    }
    
    // Always show overdue at the top (unless overdue filter is selected)
    if (selectedFilter !== 'overdue' as FilterType) {
      return [...overdueActivities, ...filteredActivities.filter(activity => !isOverdue(activity.reminder_date))];
    }
    
    return filteredActivities;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (timeStr: string) => {
    if (!timeStr) return '';
    return new Date(`1970-01-01T${timeStr}`).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const getReminderIcon = (reminderDate: string) => {
    if (isOverdue(reminderDate)) {
      return <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />;
    } else if (isToday(reminderDate)) {
      return <Bell className="h-5 w-5 text-blue-600 dark:text-blue-400" />;
    } else {
      return <Clock className="h-5 w-5 text-slate-600 dark:text-slate-400" />;
    }
  };

  const getReminderBorder = (reminderDate: string) => {
    if (isOverdue(reminderDate)) {
      return 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20';
    } else if (isToday(reminderDate)) {
      return 'border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20';
    } else {
      return 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800';
    }
  };

  const toggleCompletion = async (activityId: string, completed: boolean) => {
    try {
      // Note: Since we don't have a completed field in the activities table,
      // we'll just update the local state for now
      setActivities(prev => 
        prev.map(activity => 
          activity.id === activityId ? { ...activity, completed } : activity
        )
      );
      
      toast({
        title: completed ? "Reminder marked as completed" : "Reminder marked as not completed",
        description: "Reminder status updated successfully."
      });
    } catch (error: any) {
      toast({
        title: "Error updating reminder",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleReminderClick = (leadId: string) => {
    navigate(`/leads/${leadId}`);
  };

  const filterOptions = [
    { key: 'overdue', label: 'Overdue' },
    { key: 'today', label: 'Today' },
    { key: 'tomorrow', label: 'Tomorrow' },
    { key: 'thisWeek', label: 'This Week' },
    { key: 'nextWeek', label: 'Next Week' },
    { key: 'selectPeriod', label: 'Select Period' }
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-gray-100 dark:from-gray-900 dark:to-slate-800">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          <p className="mt-4 text-muted-foreground">Loading reminders...</p>
        </div>
      </div>
    );
  }

  const filteredActivities = getFilteredActivities();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 dark:from-gray-900 dark:to-slate-800">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/")}
            className="hover:shadow-md transition-shadow"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
              Reminder Details
            </h1>
            <p className="text-muted-foreground">Manage your task reminders</p>
          </div>
        </div>
      </header>

      {/* Filter Bar */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-2 overflow-x-auto">
            {filterOptions.map((option) => (
              <Button
                key={option.key}
                variant={selectedFilter === option.key ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedFilter(option.key as FilterType)}
                className="whitespace-nowrap"
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <main className="container mx-auto px-4 py-8">
        <Card className="shadow-md hover:shadow-lg transition-shadow border-slate-200 dark:border-slate-700">
          <CardContent className="pt-6">
            <div className="space-y-4">
              {filteredActivities.length === 0 ? (
                <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                  <Bell className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-medium mb-2">No reminders found</h3>
                  <p>You don't have any reminders for the selected filter.</p>
                </div>
              ) : (
                filteredActivities.map((activity) => (
                  <div
                    key={activity.id}
                    className={`p-4 border rounded-lg transition-all duration-200 cursor-pointer ${getReminderBorder(activity.reminder_date)}`}
                    onClick={() => handleReminderClick(activity.lead_id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        {getReminderIcon(activity.reminder_date)}
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-slate-800 dark:text-slate-200">
                              {activity.content}
                            </h4>
                          </div>
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            Lead: {getLeadName(activity.lead_id)}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-500">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDate(activity.reminder_date)}
                            </div>
                            {activity.reminder_time && (
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatTime(activity.reminder_time)}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          {isOverdue(activity.reminder_date) && (
                            <Badge variant="destructive" className="text-xs">
                              Overdue
                            </Badge>
                          )}
                          {isToday(activity.reminder_date) && (
                            <Badge variant="default" className="text-xs">
                              Due Today
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <RadioGroup
                            value={activity.completed ? "completed" : "notCompleted"}
                            onValueChange={(value) => toggleCompletion(activity.id, value === "completed")}
                          >
                            <div className="flex items-center space-x-1">
                              <RadioGroupItem value="notCompleted" id={`not-completed-${activity.id}`} />
                              <Circle className="h-4 w-4 text-slate-400" />
                            </div>
                            <div className="flex items-center space-x-1">
                              <RadioGroupItem value="completed" id={`completed-${activity.id}`} />
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            </div>
                          </RadioGroup>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default ReminderDetails;