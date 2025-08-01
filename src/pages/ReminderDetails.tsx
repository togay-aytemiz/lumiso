import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Bell, CheckSquare } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { DateRangePicker } from "@/components/DateRangePicker";
import ReminderCard from "@/components/ReminderCard";
import type { DateRange } from "react-day-picker";
import { formatDate, formatTime, formatDateTime, getWeekRange } from "@/lib/utils";
import Layout from "@/components/Layout";

interface Activity {
  id: string;
  content: string;
  reminder_date: string;
  reminder_time: string;
  type: string;
  lead_id: string;
  created_at: string;
  updated_at: string;
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
  const [showCompleted, setShowCompleted] = useState(false);
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
    const { start: startOfWeek, end: endOfWeek } = getWeekRange(today);
    reminder.setHours(0, 0, 0, 0);
    
    return reminder.getTime() >= startOfWeek.getTime() && reminder.getTime() <= endOfWeek.getTime();
  };

  const isNextWeek = (reminderDate: string) => {
    const today = new Date();
    const reminder = new Date(reminderDate);
    const nextWeekDate = new Date(today);
    nextWeekDate.setDate(today.getDate() + 7);
    const { start: startOfNextWeek, end: endOfNextWeek } = getWeekRange(nextWeekDate);
    
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
    const activeActivities = activities.filter(activity => !activity.completed);
    const completedActivities = activities.filter(activity => activity.completed);
    
    let filteredActiveActivities: Activity[] = [];
    let filteredCompletedActivities: Activity[] = [];
    
    // Filter active activities based on selected filter
    switch (selectedFilter) {
      case 'overdue':
        filteredActiveActivities = activeActivities.filter(activity => isOverdue(activity.reminder_date));
        break;
      case 'today':
        filteredActiveActivities = activeActivities.filter(activity => isToday(activity.reminder_date));
        break;
      case 'tomorrow':
        filteredActiveActivities = activeActivities.filter(activity => isTomorrow(activity.reminder_date));
        break;
      case 'thisWeek':
        filteredActiveActivities = activeActivities.filter(activity => isThisWeek(activity.reminder_date));
        break;
      case 'nextWeek':
        filteredActiveActivities = activeActivities.filter(activity => isNextWeek(activity.reminder_date));
        break;
      case 'thisMonth':
        filteredActiveActivities = activeActivities.filter(activity => isThisMonth(activity.reminder_date));
        break;
      case 'selectPeriod':
        filteredActiveActivities = activeActivities.filter(activity => isInDateRange(activity.reminder_date));
        filteredCompletedActivities = completedActivities.filter(activity => isInDateRange(activity.reminder_date));
        break;
      default:
        filteredActiveActivities = activeActivities;
    }
    
    // Filter completed activities when showCompleted is true (except for selectPeriod which handles it above)
    if (showCompleted && selectedFilter !== 'selectPeriod') {
      switch (selectedFilter) {
        case 'overdue':
          filteredCompletedActivities = completedActivities.filter(activity => isOverdue(activity.reminder_date));
          break;
        case 'today':
          filteredCompletedActivities = completedActivities.filter(activity => isToday(activity.reminder_date));
          break;
        case 'tomorrow':
          filteredCompletedActivities = completedActivities.filter(activity => isTomorrow(activity.reminder_date));
          break;
        case 'thisWeek':
          filteredCompletedActivities = completedActivities.filter(activity => isThisWeek(activity.reminder_date));
          break;
        case 'nextWeek':
          filteredCompletedActivities = completedActivities.filter(activity => isNextWeek(activity.reminder_date));
          break;
        case 'thisMonth':
          filteredCompletedActivities = completedActivities.filter(activity => isThisMonth(activity.reminder_date));
          break;
        default:
          filteredCompletedActivities = completedActivities;
      }
    }
    
    // For active activities, show overdue at the top if not on overdue filter
    let finalActiveActivities = filteredActiveActivities;
    if (selectedFilter !== 'overdue') {
      const overdueActivities = activeActivities.filter(activity => isOverdue(activity.reminder_date));
      finalActiveActivities = [...overdueActivities, ...filteredActiveActivities.filter(activity => !isOverdue(activity.reminder_date))];
    }
    
    // Combine active and completed activities
    const allActivities = [...finalActiveActivities];
    if (showCompleted || selectedFilter === 'selectPeriod') {
      allActivities.push(...filteredCompletedActivities);
    }
    
    return allActivities;
  };

  const getCompletedActivitiesGroupedByDate = () => {
    const completedActivities = activities.filter(activity => activity.completed);
    let filteredCompletedActivities: Activity[] = [];
    
    // Filter completed activities based on selected filter
    switch (selectedFilter) {
      case 'overdue':
        filteredCompletedActivities = completedActivities.filter(activity => isOverdue(activity.reminder_date));
        break;
      case 'today':
        filteredCompletedActivities = completedActivities.filter(activity => isToday(activity.reminder_date));
        break;
      case 'tomorrow':
        filteredCompletedActivities = completedActivities.filter(activity => isTomorrow(activity.reminder_date));
        break;
      case 'thisWeek':
        filteredCompletedActivities = completedActivities.filter(activity => isThisWeek(activity.reminder_date));
        break;
      case 'nextWeek':
        filteredCompletedActivities = completedActivities.filter(activity => isNextWeek(activity.reminder_date));
        break;
      case 'thisMonth':
        filteredCompletedActivities = completedActivities.filter(activity => isThisMonth(activity.reminder_date));
        break;
      case 'selectPeriod':
        filteredCompletedActivities = completedActivities.filter(activity => isInDateRange(activity.reminder_date));
        break;
      default:
        filteredCompletedActivities = completedActivities;
    }
    
    // Group by completion date (using updated_at as completion date)
    const groupedByDate = filteredCompletedActivities.reduce((groups, activity) => {
      const completionDate = new Date(activity.updated_at);
      const dateKey = completionDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(activity);
      return groups;
    }, {} as Record<string, Activity[]>);
    
    // Sort groups by date (most recent first)
    const sortedGroups = Object.entries(groupedByDate).sort(([, a], [, b]) => {
      const dateA = new Date(a[0].updated_at);
      const dateB = new Date(b[0].updated_at);
      return dateB.getTime() - dateA.getTime();
    });
    
    return sortedGroups;
  };

  const getReminderCountForFilter = (filterType: FilterType) => {
    // Get activities based on showCompleted toggle
    let targetActivities = showCompleted ? activities : activities.filter(activity => !activity.completed);
    
    switch (filterType) {
      case 'overdue':
        return targetActivities.filter(activity => isOverdue(activity.reminder_date)).length;
      case 'today':
        return targetActivities.filter(activity => isToday(activity.reminder_date)).length;
      case 'tomorrow':
        return targetActivities.filter(activity => isTomorrow(activity.reminder_date)).length;
      case 'thisWeek':
        return targetActivities.filter(activity => isThisWeek(activity.reminder_date)).length;
      case 'nextWeek':
        return targetActivities.filter(activity => isNextWeek(activity.reminder_date)).length;
      case 'thisMonth':
        return targetActivities.filter(activity => isThisMonth(activity.reminder_date)).length;
      case 'selectPeriod':
        return targetActivities.filter(activity => isInDateRange(activity.reminder_date)).length;
      default:
        return targetActivities.length;
    }
  };


  const shouldShowStatusBadge = (activity: Activity) => {
    // Never show overdue badge for completed reminders
    if (activity.completed) return false;
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
  const completedGroupedByDate = getCompletedActivitiesGroupedByDate();
  const activeActivities = filteredActivities.filter(activity => !activity.completed);

  return (
    <Layout>
      <div className="bg-background">
        <div className="p-6 border-b">
          <h1 className="text-3xl font-bold">Reminder Details</h1>
          <p className="text-muted-foreground">Manage your task reminders</p>
        </div>

        {/* Filter Bar */}
        <div className="bg-background border-b">
          <div className="px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 overflow-x-auto">
              {filterOptions.map((option) => (
                <Button
                  key={option.key}
                  variant={selectedFilter === option.key ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedFilter(option.key as FilterType)}
                  className="whitespace-nowrap"
                >
                  {option.label} ({getReminderCountForFilter(option.key as FilterType)})
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
            
            {/* Show Completed Toggle */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <CheckSquare className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground whitespace-nowrap">Show Completed</span>
              <Switch
                checked={showCompleted}
                onCheckedChange={setShowCompleted}
              />
            </div>
          </div>
          </div>
        </div>

        <main className="px-6 py-6">
        <div className="space-y-6">
          {/* Active Reminders */}
          {activeActivities.length === 0 && (!showCompleted || completedGroupedByDate.length === 0) ? (
            <div className="text-center py-12 text-slate-500 dark:text-slate-400">
              <Bell className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">No reminders found</h3>
              <p>You don't have any reminders for the selected filter.</p>
            </div>
          ) : (
            <>
              {/* Show active reminders */}
              {activeActivities.length > 0 && (
                <div className="space-y-3">
                  {activeActivities.map((activity) => (
                    <ReminderCard
                      key={activity.id}
                      activity={activity}
                      leadName={getLeadName(activity.lead_id)}
                      onToggleCompletion={toggleCompletion}
                      onClick={() => handleReminderClick(activity.lead_id)}
                      hideStatusBadge={!shouldShowStatusBadge(activity)}
                    />
                  ))}
                </div>
              )}

              {/* Show completed reminders grouped by completion date */}
              {showCompleted && completedGroupedByDate.length > 0 && (
                <div className="space-y-4">
                  {activeActivities.length > 0 && (
                    <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
                      <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
                        Completed Reminders
                      </h2>
                    </div>
                  )}
                  
                  {completedGroupedByDate.map(([dateKey, activities]) => (
                    <div key={dateKey} className="space-y-3">
                      <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700 pb-2">
                        {dateKey}
                      </h3>
                      <div className="space-y-2 ml-4">
                        {activities.map((activity) => (
                          <ReminderCard
                            key={activity.id}
                            activity={activity}
                            leadName={getLeadName(activity.lead_id)}
                            onToggleCompletion={toggleCompletion}
                            onClick={() => handleReminderClick(activity.lead_id)}
                            hideStatusBadge={!shouldShowStatusBadge(activity)}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        </main>
      </div>
    </Layout>
  );
};

export default ReminderDetails;