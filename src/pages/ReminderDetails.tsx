import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Bell, CheckSquare } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { DateRangePicker } from "@/components/DateRangePicker";
import ReminderCard from "@/components/ReminderCard";
import type { DateRange } from "react-day-picker";
import { formatDate, formatTime, formatDateTime, formatGroupDate, getWeekRange } from "@/lib/utils";
import GlobalSearch from "@/components/GlobalSearch";
import { PageHeader, PageHeaderSearch } from "@/components/ui/page-header";
import { FilterBar } from "@/components/FilterBar";
import { ListLoadingSkeleton } from "@/components/ui/loading-presets";

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

type FilterType = 'all' | 'overdue' | 'today' | 'tomorrow' | 'thisWeek' | 'nextWeek' | 'thisMonth';

const ReminderDetails = () => {
  const { t } = useTranslation('pages');
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

  const getFilteredActivities = () => {
    const activeActivities = activities.filter(activity => !activity.completed);
    const completedActivities = activities.filter(activity => activity.completed);
    
    let filteredActiveActivities: Activity[] = [];
    let filteredCompletedActivities: Activity[] = [];
    
    // Filter active activities based on selected filter
    switch (selectedFilter) {
      case 'all':
        filteredActiveActivities = activeActivities;
        filteredCompletedActivities = completedActivities;
        break;
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
      default:
        filteredActiveActivities = activeActivities;
    }
    
    // For active activities, show overdue at the top if not on overdue filter
    let finalActiveActivities = filteredActiveActivities;
    if (selectedFilter !== 'overdue') {
      const overdueActivities = activeActivities.filter(activity => isOverdue(activity.reminder_date));
      finalActiveActivities = [...overdueActivities, ...filteredActiveActivities.filter(activity => !isOverdue(activity.reminder_date))];
    }
    
    // Combine active and completed activities
    const allActivities = [...finalActiveActivities];
    if (showCompleted || selectedFilter === 'all') {
      allActivities.push(...filteredCompletedActivities);
    }
    
    return allActivities;
  };

  const getReminderCountForFilter = (filterType: FilterType) => {
    let targetActivities = showCompleted ? activities : activities.filter(activity => !activity.completed);
    
    switch (filterType) {
      case 'all':
        return targetActivities.length;
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

  // Prepare filter options for FilterBar
  const quickFilters = [
    { key: 'all', label: t('reminders.filters.all'), count: getReminderCountForFilter('all') },
    { key: 'today', label: t('reminders.filters.today'), count: getReminderCountForFilter('today') },
    { key: 'tomorrow', label: t('reminders.filters.tomorrow'), count: getReminderCountForFilter('tomorrow') }
  ];

  const allDateFilters = [
    { key: 'all', label: t('reminders.filters.all'), count: getReminderCountForFilter('all') },
    { key: 'overdue', label: t('reminders.filters.overdue'), count: getReminderCountForFilter('overdue') },
    { key: 'today', label: t('reminders.filters.today'), count: getReminderCountForFilter('today') },
    { key: 'tomorrow', label: t('reminders.filters.tomorrow'), count: getReminderCountForFilter('tomorrow') },
    { key: 'thisWeek', label: t('reminders.filters.thisWeek'), count: getReminderCountForFilter('thisWeek') },
    { key: 'nextWeek', label: t('reminders.filters.nextWeek'), count: getReminderCountForFilter('nextWeek') },
    { key: 'thisMonth', label: t('reminders.filters.thisMonth'), count: getReminderCountForFilter('thisMonth') }
  ];

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <PageHeader
        title={t('reminders.title')}
        subtitle={t('reminders.description')}
      >
        <PageHeaderSearch>
          <div className="flex items-center gap-2 w-full">
            <div className="flex-1 min-w-0">
              <GlobalSearch />
            </div>
          </div>
        </PageHeaderSearch>
      </PageHeader>

      <div className="p-4 sm:p-6 space-y-6">
        {loading ? (
          <ListLoadingSkeleton />
        ) : (
          <>
            {/* Mobile Filter Bar (≤767px only) */}
            <div className="md:hidden">
              <FilterBar
                quickFilters={quickFilters}
                activeQuickFilter={selectedFilter}
                onQuickFilterChange={(filter) => setSelectedFilter(filter as FilterType)}
                allDateFilters={allDateFilters}
                activeDateFilter={selectedFilter}
                onDateFilterChange={(filter) => setSelectedFilter(filter as FilterType)}
                  showCompleted={showCompleted}
                  onShowCompletedChange={setShowCompleted}
                  showCompletedLabel={t('reminders.showCompleted')}
                isSticky={true}
              />
            </div>

            {/* Desktop Filter Bar (≥768px only) */}
            <div className="hidden md:flex bg-background border-b">
              <div className="px-4 sm:px-6 py-4 w-full">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    {allDateFilters.map((option) => (
                      <Button
                        key={option.key}
                        variant={selectedFilter === option.key ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedFilter(option.key as FilterType)}
                        className="whitespace-nowrap"
                      >
                        {option.label} ({option.count})
                      </Button>
                    ))}
                  </div>
                  
                  {/* Show Completed Toggle */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <CheckSquare className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground whitespace-nowrap">{t('reminders.showCompleted')}</span>
                    <Switch
                      checked={showCompleted}
                      onCheckedChange={setShowCompleted}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Main Content */}
            <div className="space-y-6">
              {(() => {
                const filteredActivities = getFilteredActivities();
                const activeActivities = filteredActivities.filter(activity => !activity.completed);

                if (activeActivities.length === 0) {
                  return (
                    <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                      <Bell className="h-16 w-16 mx-auto mb-4 opacity-50" />
                      <h3 className="text-lg font-medium mb-2">{t('reminders.emptyState.title')}</h3>
                      <p>{t('reminders.emptyState.description')}</p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-3">
                    {activeActivities.map((activity) => (
                      <ReminderCard
                        key={activity.id}
                        activity={activity}
                        leadName={getLeadName(activity.lead_id)}
                        onToggleCompletion={toggleCompletion}
                        onClick={() => handleReminderClick(activity.lead_id)}
                        hideStatusBadge={!shouldShowStatusBadge(activity)}
                        hideReminderBadge
                      />
                    ))}
                  </div>
                );
              })()}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ReminderDetails;
