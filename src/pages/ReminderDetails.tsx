import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { DateRangePicker } from "@/components/DateRangePicker";
import ReminderCard from "@/components/ReminderCard";
import type { DateRange } from "react-day-picker";

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

type FilterType = 'overdue' | 'today' | 'tomorrow' | 'thisWeek' | 'nextWeek' | 'thisMonth' | 'selectPeriod';

const ReminderDetails = () => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState<FilterType>('today');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
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

  const isThisMonth = (reminderDate: string) => {
    const today = new Date();
    const reminder = new Date(reminderDate);
    
    return today.getFullYear() === reminder.getFullYear() && 
           today.getMonth() === reminder.getMonth();
  };

  const isInDateRange = (reminderDate: string) => {
    if (!dateRange?.from) return true;
    
    const reminder = new Date(reminderDate);
    reminder.setHours(0, 0, 0, 0);
    
    const from = new Date(dateRange.from);
    from.setHours(0, 0, 0, 0);
    
    const to = dateRange.to ? new Date(dateRange.to) : new Date(dateRange.from);
    to.setHours(23, 59, 59, 999);
    
    return reminder.getTime() >= from.getTime() && reminder.getTime() <= to.getTime();
  };

  const getFilteredActivities = () => {
    // Exclude completed reminders from active filters (overdue, today, etc.)
    const activeActivities = activities.filter(activity => !activity.completed);
    const completedActivities = activities.filter(activity => activity.completed);
    
    let filteredActivities: Activity[] = [];
    
    switch (selectedFilter) {
      case 'overdue':
        filteredActivities = activeActivities.filter(activity => isOverdue(activity.reminder_date));
        break;
      case 'today':
        filteredActivities = activeActivities.filter(activity => isToday(activity.reminder_date));
        break;
      case 'tomorrow':
        filteredActivities = activeActivities.filter(activity => isTomorrow(activity.reminder_date));
        break;
      case 'thisWeek':
        filteredActivities = activeActivities.filter(activity => isThisWeek(activity.reminder_date));
        break;
      case 'nextWeek':
        filteredActivities = activeActivities.filter(activity => isNextWeek(activity.reminder_date));
        break;
      case 'thisMonth':
        filteredActivities = activeActivities.filter(activity => isThisMonth(activity.reminder_date));
        break;
      case 'selectPeriod':
        // For select period, show both active and completed reminders
        filteredActivities = activities.filter(activity => isInDateRange(activity.reminder_date));
        break;
      default:
        filteredActivities = activities;
    }
    
    // For select period, return as is (includes completed)
    if (selectedFilter === 'selectPeriod') {
      return filteredActivities;
    }
    
    // For other filters, show overdue at the top if not on overdue filter
    const overdueActivities = activeActivities.filter(activity => isOverdue(activity.reminder_date));
    if (selectedFilter !== 'overdue') {
      return [...overdueActivities, ...filteredActivities.filter(activity => !isOverdue(activity.reminder_date))];
    }
    
    return filteredActivities;
  };


  const shouldShowStatusBadge = (activity: Activity) => {
    // Hide badge if current filter already implies the status
    if (selectedFilter === 'overdue' && isOverdue(activity.reminder_date)) return false;
    if (selectedFilter === 'today' && isToday(activity.reminder_date)) return false;
    return true;
  };

  const toggleCompletion = async (activityId: string, completed: boolean) => {
    try {
      // Update the completion status in the database
      const { error } = await supabase
        .from('activities')
        .update({ completed })
        .eq('id', activityId);

      if (error) throw error;

      // Update local state to reflect the change immediately
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
    { key: 'thisMonth', label: 'This Month' },
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-4 mb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              Reminder Details
            </h1>
            <p className="text-slate-600 dark:text-slate-400">Manage your task reminders</p>
          </div>
        </div>
      </header>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <div className="container mx-auto px-4 py-4">
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
            {selectedFilter === 'selectPeriod' && (
              <DateRangePicker
                dateRange={dateRange}
                onDateRangeChange={setDateRange}
                className="ml-2"
              />
            )}
          </div>
        </div>
      </div>

      <main className="container mx-auto px-4 py-6">
        <div className="space-y-3">
          {filteredActivities.length === 0 ? (
            <div className="text-center py-12 text-slate-500 dark:text-slate-400">
              <Bell className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">No reminders found</h3>
              <p>You don't have any reminders for the selected filter.</p>
            </div>
          ) : (
            filteredActivities.map((activity) => (
              <ReminderCard
                key={activity.id}
                activity={activity}
                leadName={getLeadName(activity.lead_id)}
                onToggleCompletion={toggleCompletion}
                onClick={() => handleReminderClick(activity.lead_id)}
                hideStatusBadge={!shouldShowStatusBadge(activity)}
              />
            ))
          )}
        </div>
      </main>
    </div>
  );
};

export default ReminderDetails;