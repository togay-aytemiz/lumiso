
import React, { useState, useEffect } from 'react';
import { Session, Lead, Reminder, LeadStatus } from '../../types';
import { 
  MapPin, 
  Calendar as CalendarIcon,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Briefcase,
  DollarSign,
  CheckSquare,
  Sparkles,
  Activity,
  StickyNote,
  Layers
} from 'lucide-react';

interface DailyFocusProps {
  sessions: Session[];
  leads: Lead[];
  reminders: Reminder[];
}

const DailyFocus: React.FC<DailyFocusProps> = ({ sessions, leads, reminders }) => {
  
  const [now, setNow] = useState(new Date());

  // Update time every minute to keep the "Now" indicator accurate
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const todayStr = now.toISOString().split('T')[0];

  // --- DATA PROCESSING ---

  // 1. Sessions for Today
  const todaysSessions = sessions
    .filter(s => s.date.startsWith(todayStr))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  
  // Find Next Session (closest future start time)
  const currentHours = now.getHours();
  const currentMinutes = now.getMinutes();
  const currentTimeVal = currentHours * 60 + currentMinutes;

  const nextSession = todaysSessions.find(s => {
    const [h, m] = s.startTime.split(':').map(Number);
    return (h * 60 + m) > currentTimeVal;
  }) || todaysSessions[0]; // Fallback to first session if all are done

  // Calculate sessions *after* the next one to display "more sessions" summary
  const laterSessions = nextSession 
    ? todaysSessions.filter(s => {
        const [nextH, nextM] = nextSession.startTime.split(':').map(Number);
        const [currH, currM] = s.startTime.split(':').map(Number);
        return (currH * 60 + currM) > (nextH * 60 + nextM);
      })
    : [];

  // 2. Reminders / Tasks Logic
  const overdueTasks = reminders.filter(r => {
    const rDate = r.dueDate.split('T')[0];
    return rDate < todayStr && r.status === 'pending';
  });

  const todayTasks = reminders.filter(r => {
    return r.dueDate.startsWith(todayStr) && r.status === 'pending';
  });

  const getTaskTime = (isoString: string) => {
      const d = new Date(isoString);
      return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
  };

  const nowTimeStr = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });

  // Unified Timeline Data
  const unifiedTimeline = [
    ...todaysSessions.map(s => ({ 
      type: 'session' as const, 
      data: s, 
      id: s.id, 
      time: s.startTime,
      sortTime: s.startTime 
    })),
    ...todayTasks.map(t => {
      const time = getTaskTime(t.dueDate);
      return { 
        type: 'reminder' as const, 
        data: t, 
        id: t.id,
        time: time,
        sortTime: time
      };
    }),
    // The "Now" Indicator Item
    {
      type: 'now' as const,
      data: null,
      id: 'now-indicator',
      time: nowTimeStr,
      sortTime: nowTimeStr
    }
  ].sort((a, b) => a.sortTime.localeCompare(b.sortTime));

  // 3. Leads Logic
  const isStale = (dateStr: string) => {
    const d = new Date(dateStr);
    const diffTime = Math.abs(now.getTime() - d.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    return diffDays > 3;
  };
  
  const inactiveLeads = leads.filter(l => 
    l.status === LeadStatus.CONTACTED && isStale(l.createdAt)
  );

  // Counts
  const totalActiveTasks = overdueTasks.length + todayTasks.length;
  const overdueCount = overdueTasks.length;
  const inactiveLeadsCount = inactiveLeads.length;
  const dueTodayCount = todayTasks.length;

  // --- UI HELPERS ---

  const dateOptions: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'long', day: 'numeric' };
  const formattedDate = now.toLocaleDateString('en-US', dateOptions);
  
  const greeting = currentHours < 12 ? 'Good Morning' : currentHours < 18 ? 'Good Afternoon' : 'Good Evening';

  // Styles for session types
  const getSessionTheme = (type: string) => {
    switch(type) {
      case 'Wedding': return { border: 'bg-rose-500', badge: 'bg-rose-50 text-rose-700', icon: 'text-rose-500' };
      case 'Portrait': return { border: 'bg-violet-500', badge: 'bg-violet-50 text-violet-700', icon: 'text-violet-500' };
      case 'Commercial': return { border: 'bg-blue-500', badge: 'bg-blue-50 text-blue-700', icon: 'text-blue-500' };
      case 'Family': return { border: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700', icon: 'text-emerald-500' };
      default: return { border: 'bg-slate-500', badge: 'bg-slate-100 text-slate-700', icon: 'text-slate-500' };
    }
  };

  // Shared Background Component (Dark for Pulse)
  const AuroraBackground = () => (
    <div className="absolute inset-0 bg-slate-900 z-0">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,#4f46e5_0%,transparent_60%)] opacity-40 mix-blend-screen"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_100%_0%,#06b6d4_0%,transparent_50%)] opacity-30 mix-blend-screen"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_0%_80%,#9333ea_0%,transparent_50%)] opacity-30 mix-blend-screen"></div>
      <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-slate-950 via-slate-900/50 to-transparent"></div>
    </div>
  );

  // Light Aurora for Schedule - Refined for "Soft Aurora" look (Pastel Tones)
  const LightAuroraBackground = () => (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
       <div className="absolute -top-[40%] -right-[20%] w-[100%] h-[100%] bg-blue-200/50 rounded-full blur-[100px]"></div>
       <div className="absolute -bottom-[40%] -left-[20%] w-[100%] h-[100%] bg-teal-200/40 rounded-full blur-[100px]"></div>
       <div className="absolute top-[20%] left-[30%] w-[70%] h-[70%] bg-fuchsia-200/40 rounded-full blur-[120px]"></div>
    </div>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* LEFT COLUMN: LUMISO PULSE CARD (Dark Theme) */}
      <div className="lg:col-span-1 relative overflow-hidden rounded-2xl p-8 text-white flex flex-col shadow-2xl min-h-[500px] border border-white/5">
        <AuroraBackground />

        <div className="relative z-10 flex-1 flex flex-col">
          {/* Branding Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2 text-transparent bg-clip-text bg-gradient-to-r from-indigo-200 to-cyan-200 font-bold text-sm uppercase tracking-widest">
              <Activity className="w-4 h-4 text-cyan-400" />
              Lumiso Pulse
            </div>
            <div className="text-indigo-300/60 text-[10px] font-mono">
              {formattedDate}
            </div>
          </div>
          
          <h1 className="text-3xl font-bold tracking-tight mb-2 drop-shadow-md">{greeting}, Jane</h1>
          <p className="text-slate-300 text-sm mb-8">
            You have <span className="text-cyan-300 font-semibold">{totalActiveTasks} active tasks</span> today.
          </p>

          {/* Next Session Highlight */}
          {nextSession && (
            <div className="mb-6">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-amber-400" />
                Up Next
              </div>
              <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-xl p-5 hover:bg-white/15 transition-all cursor-pointer group shadow-lg relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-indigo-500 to-purple-500"></div>
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-bold text-lg leading-tight text-white group-hover:text-indigo-200 transition-colors">
                    {nextSession.title}
                  </h3>
                  <span className="bg-indigo-500/40 border border-indigo-500/30 text-indigo-100 text-[10px] font-bold px-2 py-1 rounded backdrop-blur-md">
                    {nextSession.startTime}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span className="truncate">{nextSession.location}</span>
                </div>
              </div>
              
              {/* Message about subsequent sessions */}
              {laterSessions.length > 0 && (
                <div className="mt-3 flex items-center gap-3 px-1 animate-fade-in">
                  <div className="flex -space-x-2">
                    {laterSessions.slice(0,3).map(s => (
                      <div key={s.id} className="w-6 h-6 rounded-full border border-slate-800 bg-indigo-900 text-indigo-200 text-[9px] flex items-center justify-center font-bold shadow-sm">
                        {s.clientName.charAt(0)}
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                    <span className="w-1 h-1 rounded-full bg-slate-500"></span>
                    <span>+{laterSessions.length} more sessions following</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Summary Cards Stack */}
          <div className="space-y-3 mt-auto">
            <button className="w-full group bg-slate-900/40 backdrop-blur-sm border border-white/5 hover:bg-white/10 hover:border-rose-500/30 active:scale-[0.98] transition-all rounded-xl p-4 flex items-center justify-between text-left">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.2)]">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xl font-bold text-white leading-none mb-1">{overdueCount}</div>
                  <div className="text-[10px] font-bold text-rose-400/80 uppercase tracking-wider">Overdue Items</div>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-slate-600 group-hover:text-white group-hover:translate-x-1 transition-all" />
            </button>

            <div className="grid grid-cols-2 gap-3">
              <button className="w-full group bg-slate-900/40 backdrop-blur-sm border border-white/5 hover:bg-white/10 hover:border-amber-500/30 active:scale-[0.98] transition-all rounded-xl p-3 flex items-center gap-3 text-left">
                <div className="w-9 h-9 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 flex-shrink-0 shadow-[0_0_10px_rgba(245,158,11,0.1)]">
                   <AlertTriangle className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-lg font-bold text-white leading-none mb-1">{inactiveLeadsCount}</div>
                  <div className="text-[10px] font-bold text-amber-400/80 uppercase tracking-wider truncate">Inactive Leads</div>
                </div>
              </button>

              <button className="w-full group bg-slate-900/40 backdrop-blur-sm border border-white/5 hover:bg-white/10 hover:border-indigo-500/30 active:scale-[0.98] transition-all rounded-xl p-3 flex items-center gap-3 text-left">
                <div className="w-9 h-9 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 flex-shrink-0 shadow-[0_0_10px_rgba(99,102,241,0.1)]">
                   <CheckCircle2 className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-lg font-bold text-white leading-none mb-1">{dueTodayCount}</div>
                  <div className="text-[10px] font-bold text-indigo-400/80 uppercase tracking-wider truncate">Due Today</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: TIMELINE SCHEDULE (Light Aurora Theme) */}
      <div className="lg:col-span-2 relative overflow-hidden rounded-2xl flex flex-col h-[500px] lg:h-auto max-h-[600px] bg-white/50 border border-slate-100 shadow-sm">
        <LightAuroraBackground />

        {/* Header */}
        <div className="relative z-10 px-6 pt-6 pb-2 flex justify-between items-center">
          <h2 className="font-bold text-slate-800 flex items-center gap-2 text-lg">
            <CalendarIcon className="w-5 h-5 text-indigo-600" />
            Today's Schedule
          </h2>
          <button className="text-xs font-medium text-indigo-600 hover:text-indigo-800 px-3 py-1 rounded-full bg-white/50 hover:bg-white/80 transition-colors border border-indigo-100 shadow-sm">
            View Calendar
          </button>
        </div>

        {/* Scrollable Timeline Container */}
        <div className="relative z-10 px-6 pb-6 flex-1 overflow-y-auto custom-scrollbar">
          
          {/* Continuous Vertical Line - Centered in Gap */}
          {unifiedTimeline.length > 0 && (
            <div className="absolute left-[7.25rem] top-0 bottom-0 w-px bg-indigo-200/60 hidden sm:block"></div>
          )}

          <div className="flex flex-col pt-2">
            {unifiedTimeline.length > 0 ? (
              unifiedTimeline.map((item, index) => {
                
                // RENDER "NOW" INDICATOR
                if (item.type === 'now') {
                  return (
                    <div key={item.id} className="relative flex flex-col sm:flex-row gap-6 items-center mb-6 mt-2 group/now">
                      {/* Time Column (Current Time) */}
                      <div className="sm:w-20 flex-shrink-0 flex justify-end items-center">
                         <div className="bg-rose-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm shadow-rose-200">
                           {item.time}
                         </div>
                      </div>

                      {/* Pulsing Dot on Line */}
                      <div className="hidden sm:flex absolute left-[5.75rem] -translate-x-1/2 z-20 items-center justify-center">
                         <div className="absolute w-3 h-3 bg-rose-400 rounded-full animate-ping opacity-75"></div>
                         <div className="relative w-2.5 h-2.5 bg-rose-600 rounded-full ring-2 ring-white shadow-sm"></div>
                      </div>

                      {/* Line across content */}
                      <div className="flex-1 w-full flex items-center relative pl-2">
                        <div className="w-full h-px bg-rose-600/30 flex items-center">
                          <div className="w-full h-px border-t border-dashed border-rose-400/50"></div>
                        </div>
                        <div className="absolute right-0 -top-2 text-[9px] font-bold text-rose-500 uppercase tracking-wider bg-white/60 backdrop-blur-sm px-1.5 rounded border border-rose-100">
                          Current Time
                        </div>
                      </div>
                    </div>
                  );
                }

                // RENDER SESSION OR REMINDER
                const isSession = item.type === 'session';
                const isLast = index === unifiedTimeline.length - 1;

                return (
                  <div 
                    key={item.id} 
                    className={`relative flex flex-col sm:flex-row gap-6 group ${isSession ? 'mb-8' : 'mb-3'} ${isLast ? '!mb-0' : ''}`}
                  >
                    
                    {/* Time Column */}
                    <div className={`sm:w-20 flex-shrink-0 flex flex-col items-start sm:items-end text-left sm:text-right ${isSession ? 'pt-1' : 'pt-0.5'}`}>
                      <span className={`leading-none tracking-tight ${isSession ? 'text-xl font-bold text-slate-800' : 'text-xs font-medium text-slate-400 font-mono group-hover:text-slate-600 transition-colors'}`}>
                        {item.time}
                      </span>
                      {isSession && item.data && (
                        <span className="text-xs text-slate-500 mt-1 font-medium">
                          {item.data.endTime}
                        </span>
                      )}
                    </div>

                    {/* Timeline Dot */}
                    <div 
                      className="hidden sm:flex absolute left-[5.75rem] -translate-x-1/2 z-10 items-center justify-center" 
                      style={{ top: isSession ? '0.5rem' : '0.25rem' }}
                    >
                      {isSession ? (
                        <div className="w-3 h-3 rounded-full bg-indigo-600 shadow-[0_0_0_4px_rgba(199,210,254,0.5)]"></div>
                      ) : (
                        <div className="w-2 h-2 rounded-full bg-slate-300 ring-4 ring-white/60 group-hover:bg-slate-400 transition-colors"></div>
                      )}
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 min-w-0">
                      {isSession && item.data ? (
                        // SESSION: Compact Horizontal Card
                        (() => {
                          const theme = getSessionTheme(item.data.type);
                          return (
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-all overflow-hidden group/card relative flex items-center p-3 pl-4 gap-4 h-auto min-h-[72px]">
                              {/* Accent Strip */}
                              <div className={`absolute left-0 top-0 bottom-0 w-1 ${theme.border}`}></div>

                              {/* Main Content */}
                              <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
                                  
                                  {/* Top Row: Title & Badges */}
                                  <div className="flex items-center gap-2">
                                      <h3 className="text-sm font-bold text-slate-900 truncate">{item.data.title}</h3>
                                      
                                      <div className="hidden sm:flex items-center gap-1.5 ml-auto sm:ml-0">
                                         <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${theme.badge}`}>
                                            {item.data.type}
                                         </span>
                                         {item.data.sessionType && (
                                            <span className="text-[9px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 truncate max-w-[120px]">
                                              {item.data.sessionType}
                                            </span>
                                         )}
                                      </div>
                                  </div>

                                  {/* Bottom Row: Client & Icons */}
                                  <div className="flex items-center gap-3 text-xs text-slate-500">
                                      {/* Client */}
                                      <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                                         <div className="w-4 h-4 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[9px] font-bold text-slate-500">
                                            {item.data.clientName.charAt(0)}
                                         </div>
                                         <span className="truncate max-w-[120px]">{item.data.clientName}</span>
                                      </div>
                                      
                                      {/* Divider */}
                                      <div className="w-px h-3 bg-slate-200"></div>
                                      
                                      {/* Location with Tooltip */}
                                      <div className="relative group/tooltip flex items-center">
                                           <MapPin className="w-3.5 h-3.5 text-slate-400 hover:text-indigo-600 cursor-help transition-colors" />
                                           {/* Tooltip */}
                                           <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/tooltip:block z-50 whitespace-nowrap bg-slate-800 text-white text-xs rounded py-1 px-2.5 shadow-lg pointer-events-none">
                                              {item.data.location}
                                              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-800 rotate-45"></div>
                                           </div>
                                      </div>

                                      {/* Notes with Tooltip */}
                                      {item.data.notes && (
                                         <div className="relative group/tooltip flex items-center">
                                             <StickyNote className="w-3.5 h-3.5 text-slate-400 hover:text-amber-500 cursor-help transition-colors" />
                                             {/* Tooltip */}
                                             <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/tooltip:block z-50 w-48 bg-amber-50 text-amber-900 border border-amber-100 text-xs rounded p-2 shadow-lg pointer-events-none text-center">
                                                "{item.data.notes}"
                                                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-amber-50 border-r border-b border-amber-100 rotate-45"></div>
                                             </div>
                                         </div>
                                      )}
                                  </div>
                              </div>

                              {/* Right Side: Chevron */}
                              <div className="pr-1 flex-shrink-0">
                                   <button className="p-1.5 rounded-full text-slate-300 hover:text-indigo-600 hover:bg-slate-50 transition-all">
                                      <ChevronRight className="w-5 h-5" />
                                   </button>
                              </div>
                            </div>
                          );
                        })()
                      ) : item.data ? (
                        // REMINDER: Transparent Row
                        <div className="flex items-center justify-between pt-0.5 pr-2 group/item hover:bg-white/40 hover:backdrop-blur-sm rounded-lg -ml-2 pl-2 py-1 transition-all">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-sm text-slate-600 font-medium truncate group-hover/item:text-slate-900 transition-colors">
                              {item.data.title}
                            </span>
                            
                            {/* Compact Meta Info */}
                            {item.data.clientName && (
                              <span className="hidden sm:flex items-center gap-1 text-xs text-slate-400">
                                <Briefcase className="w-3 h-3" />
                                <span className="truncate max-w-[120px]">{item.data.clientName}</span>
                              </span>
                            )}
                            
                            {item.data.type === 'payment' && item.data.amount && (
                              <span className="flex items-center gap-0.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">
                                <DollarSign className="w-2.5 h-2.5" />
                                {item.data.amount}
                              </span>
                            )}
                          </div>

                          {/* Minimal Action */}
                          <button className="opacity-0 group-hover/item:opacity-100 text-slate-400 hover:text-indigo-600 transition-all">
                            <CheckSquare className="w-4 h-4" />
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center opacity-50">
                <div className="w-16 h-16 bg-indigo-50/80 rounded-full flex items-center justify-center mb-4">
                   <CalendarIcon className="w-8 h-8 text-indigo-300" />
                </div>
                <h3 className="text-lg font-bold text-slate-800">No Schedule Today</h3>
                <p className="text-slate-500 mt-1 text-sm max-w-xs">
                  Your schedule is clear. Enjoy the aurora.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
};

export default DailyFocus;
