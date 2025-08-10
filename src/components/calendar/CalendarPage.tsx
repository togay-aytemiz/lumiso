import { useState, useRef, useCallback } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import allLocales from '@fullcalendar/core/locales-all';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { loadCalendarEvents, type CalendarEvent } from '@/lib/calendar/dataAdapter';
import { formatDate } from '@/lib/utils';
import Layout from '@/components/Layout';

type CalendarView = 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay';

const CalendarPage = () => {
  const [currentView, setCurrentView] = useState<CalendarView>('dayGridMonth');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const calendarRef = useRef<FullCalendar>(null);

  const handleViewChange = (view: CalendarView) => {
    setCurrentView(view);
    const calendarApi = calendarRef.current?.getApi();
    if (calendarApi) {
      calendarApi.changeView(view);
    }
  };

  const handleToday = () => {
    const calendarApi = calendarRef.current?.getApi();
    if (calendarApi) {
      calendarApi.today();
      setCurrentDate(new Date());
    }
  };

  const handlePrev = () => {
    const calendarApi = calendarRef.current?.getApi();
    if (calendarApi) {
      calendarApi.prev();
      setCurrentDate(calendarApi.getDate());
    }
  };

  const handleNext = () => {
    const calendarApi = calendarRef.current?.getApi();
    if (calendarApi) {
      calendarApi.next();
      setCurrentDate(calendarApi.getDate());
    }
  };

  const handleEventClick = useCallback((clickInfo: any) => {
    // TODO Phase 2: navigate to Lead details for sessions; mark reminder complete inline
    console.log('Event clicked:', clickInfo.event.extendedProps);
  }, []);

  const handleEventsSet = useCallback((events: any[]) => {
    setEvents(events.map(event => ({
      id: event.id,
      title: event.title,
      type: event.extendedProps.type,
      start: event.startStr,
      end: event.endStr,
      allDay: event.allDay,
      extendedProps: event.extendedProps,
    })));
  }, []);

  const loadEvents = useCallback(async (info: any, successCallback: any, failureCallback: any) => {
    setLoading(true);
    try {
      const events = await loadCalendarEvents({
        start: info.startStr,
        end: info.endStr,
      });

      const fullCalendarEvents = events.map(event => ({
        id: event.id,
        title: event.title,
        start: event.start,
        end: event.end,
        allDay: event.allDay,
        extendedProps: event.extendedProps,
        classNames: [
          'calendar-event',
          event.type === 'session' ? 'calendar-event-session' : 'calendar-event-reminder'
        ],
      }));

      successCallback(fullCalendarEvents);
    } catch (error) {
      console.error('Failed to load calendar events:', error);
      failureCallback(error);
    } finally {
      setLoading(false);
    }
  }, []);

  const formatTitle = (date: Date, view: CalendarView) => {
    const locale = navigator.language;
    if (view === 'dayGridMonth') {
      return date.toLocaleDateString(locale, { year: 'numeric', month: 'long' });
    } else if (view === 'timeGridWeek') {
      return `Week of ${formatDate(date.toISOString(), locale)}`;
    } else {
      return formatDate(date.toISOString(), locale);
    }
  };

  const hasEvents = events.length > 0;

  return (
    <Layout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h1 className="text-3xl font-bold text-foreground">Calendar</h1>
          
          {/* Calendar Toolbar */}
          <div className="flex flex-col sm:flex-row items-center gap-4">
            {/* Navigation Controls */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleToday}
                aria-label="Today"
              >
                Today
              </Button>
              <div className="flex items-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handlePrev}
                  aria-label="Previous period"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleNext}
                  aria-label="Next period"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Current Period Display */}
            <div className="text-lg font-semibold text-center min-w-[200px]">
              {formatTitle(currentDate, currentView)}
            </div>

            {/* View Switch */}
            <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
              <Button
                variant={currentView === 'timeGridDay' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => handleViewChange('timeGridDay')}
                aria-label="Day view"
              >
                Day
              </Button>
              <Button
                variant={currentView === 'timeGridWeek' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => handleViewChange('timeGridWeek')}
                aria-label="Week view"
              >
                Week
              </Button>
              <Button
                variant={currentView === 'dayGridMonth' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => handleViewChange('dayGridMonth')}
                aria-label="Month view"
              >
                Month
              </Button>
            </div>
          </div>
        </div>

        {/* Empty State */}
        {!loading && !hasEvents && (
          <Card className="p-8 text-center">
            <CalendarDays className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">
              No sessions or reminders for this period
            </p>
          </Card>
        )}

        {/* Calendar */}
        <Card className="p-6">
          {loading && (
            <div className="h-96 flex items-center justify-center">
              <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full"></div>
            </div>
          )}
          
          <div className={loading ? 'opacity-50' : ''}>
            <FullCalendar
              ref={calendarRef}
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              headerToolbar={false} // We use our own toolbar
              locale={navigator.language}
              locales={allLocales}
              navLinks={false}
              selectable={false}
              nowIndicator={true}
              eventTimeFormat={{
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
              }}
              events={loadEvents}
              eventClick={handleEventClick}
              eventsSet={handleEventsSet}
              height="auto"
              dayMaxEvents={3}
              moreLinkClick="popover"
              eventDisplay="block"
              dayHeaderFormat={{
                weekday: 'short',
              }}
              slotLabelFormat={{
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
              }}
              // Responsive behavior
              handleWindowResize={true}
              aspectRatio={window.innerWidth < 768 ? 1.0 : 1.35}
            />
          </div>
        </Card>
      </div>
    </Layout>
  );
};

export default CalendarPage;