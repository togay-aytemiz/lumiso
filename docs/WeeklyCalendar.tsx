import React from 'react';
import { Session } from '../../types';

interface WeeklyCalendarProps {
  sessions: Session[];
  currentDate: Date;
}

const WeeklyCalendar: React.FC<WeeklyCalendarProps> = ({ sessions, currentDate }) => {
  // Actual today for highlighting
  const todayReal = new Date();

  // Calculate start of the week (Monday) based on the passed currentDate
  const startOfWeek = new Date(currentDate);
  const day = startOfWeek.getDay();
  const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  startOfWeek.setDate(diff);
  // Reset time to ensure consistent comparison
  startOfWeek.setHours(0, 0, 0, 0);

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    return d;
  });

  const hours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];

  const getSessionStyle = (start: string, end: string) => {
    // Simple parser for HH:mm to relative position
    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);
    
    const startOffset = (startH - 8) * 60 + startM;
    const duration = (endH * 60 + endM) - (startH * 60 + startM);
    
    return {
      top: `${(startOffset / 60) * 48}px`, // 48px per hour row height
      height: `${(duration / 60) * 48}px`
    };
  };

  return (
    <div className="flex flex-col h-full">
      {/* Calendar Header */}
      <div className="grid grid-cols-8 border-b border-slate-200">
        <div className="p-2 text-xs font-medium text-slate-400 text-center border-r border-slate-100 bg-slate-50/50 flex flex-col justify-center">
          TIME
        </div>
        {weekDays.map((date, i) => {
          const isToday = date.toDateString() === todayReal.toDateString();
          return (
            <div key={i} className={`p-2 text-center border-r border-slate-100 transition-colors ${isToday ? 'bg-indigo-50/50' : ''}`}>
              <div className={`text-[10px] uppercase tracking-wider mb-1 ${isToday ? 'text-indigo-600 font-bold' : 'text-slate-500'}`}>
                {date.toLocaleDateString('en-US', { weekday: 'short' })}
              </div>
              <div className={`
                text-sm font-semibold inline-flex items-center justify-center w-8 h-8 rounded-full mx-auto transition-all
                ${isToday ? 'bg-indigo-600 text-white shadow-md scale-105' : 'text-slate-700'}
              `}>
                {date.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 overflow-y-auto custom-scrollbar relative bg-white" style={{ maxHeight: '300px' }}>
        {/* Grid Lines */}
        <div className="absolute inset-0 grid grid-cols-8 pointer-events-none">
          <div className="border-r border-slate-100 bg-slate-50/30"></div> {/* Time col background */}
          {weekDays.map((date, i) => {
            const isToday = date.toDateString() === todayReal.toDateString();
            return (
              <div key={i} className={`border-r border-slate-50 ${isToday ? 'bg-indigo-50/20' : ''}`}></div>
            );
          })}
        </div>

        {/* Time Rows */}
        {hours.map((hour) => (
          <div key={hour} className="grid grid-cols-8 h-12 border-b border-slate-50 relative">
            <div className="text-[10px] text-slate-400 text-right pr-2 pt-1 font-medium -mt-2">
              {hour}:00
            </div>
            <div className="col-span-7"></div> {/* Spanning columns for grid visual */}
          </div>
        ))}

        {/* Events Layer */}
        <div className="absolute inset-0 grid grid-cols-8 pointer-events-none">
          <div></div> {/* Skip Time Col */}
          {weekDays.map((date, dayIndex) => {
            // Filter sessions for this day
            const daySessions = sessions.filter(s => 
              new Date(s.date).toDateString() === date.toDateString()
            );

            return (
              <div key={dayIndex} className="relative h-full pointer-events-auto">
                {daySessions.map(session => {
                  const style = getSessionStyle(session.startTime, session.endTime);
                  return (
                    <div
                      key={session.id}
                      className={`
                        absolute inset-x-1 rounded-md border text-[10px] p-1 leading-tight shadow-sm cursor-pointer hover:opacity-90 overflow-hidden
                        ${session.type === 'Wedding' ? 'bg-rose-50 border-rose-200 text-rose-700' : 
                          session.type === 'Commercial' ? 'bg-blue-50 border-blue-200 text-blue-700' : 
                          'bg-emerald-50 border-emerald-200 text-emerald-700'}
                      `}
                      style={style}
                      title={`${session.title} (${session.startTime} - ${session.endTime})`}
                    >
                      <div className="font-semibold truncate">{session.title}</div>
                      <div className="opacity-75 truncate">{session.startTime}</div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default WeeklyCalendar;