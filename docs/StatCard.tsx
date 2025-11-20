import React from 'react';
import { LucideIcon, TrendingUp, TrendingDown, HelpCircle } from 'lucide-react';

interface StatCardProps {
  context?: React.ReactNode;
  label: string;
  value: string;
  trend?: number;   // Percentage. If undefined, renders as neutral badge if trendLabel exists.
  trendLabel?: string;
  icon: LucideIcon;
  color: 'indigo' | 'emerald' | 'amber' | 'rose' | 'blue';
}

const StatCard: React.FC<StatCardProps> = ({ 
  context, 
  label, 
  value, 
  trend, 
  trendLabel, 
  icon: Icon, 
  color 
}) => {
  
  // Map abstract color names to specific Tailwind classes matching the design system
  const colorStyles = {
    indigo: { bg: 'bg-indigo-500', text: 'text-white', badge: 'bg-indigo-50 text-indigo-700' },
    blue: { bg: 'bg-blue-500', text: 'text-white', badge: 'bg-blue-50 text-blue-600' },
    emerald: { bg: 'bg-emerald-500', text: 'text-white', badge: 'bg-emerald-50 text-emerald-700' },
    amber: { bg: 'bg-amber-500', text: 'text-white', badge: 'bg-amber-50 text-amber-700' },
    rose: { bg: 'bg-rose-500', text: 'text-white', badge: 'bg-rose-50 text-rose-700' },
  };

  const theme = colorStyles[color] || colorStyles.indigo;
  
  // Determine if we have a trend to show (either numeric or just a label)
  const hasTrend = trend !== undefined;
  const hasBadge = hasTrend || trendLabel;

  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] flex items-start gap-5 transition-all hover:shadow-md">
      {/* Icon Section - Large Circular with Solid Background */}
      <div className={`flex-shrink-0 w-14 h-14 rounded-full flex items-center justify-center shadow-sm ${theme.bg} ${theme.text}`}>
        <Icon className="w-7 h-7" strokeWidth={2} />
      </div>

      {/* Content Section */}
      <div className="flex-1 min-w-0 pt-1">
        {/* Context Label (Upper, Small) */}
        {context && (
          <div className="text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-0.5 min-h-[16px] flex items-center">
            {context}
          </div>
        )}
        
        {/* Main Label with Help Icon */}
        <div className="flex items-center gap-1.5 mb-1.5">
          <h3 className="text-sm font-medium text-slate-600">{label}</h3>
          <HelpCircle className="w-3.5 h-3.5 text-slate-300 cursor-pointer hover:text-slate-400" />
        </div>

        {/* Value and Trend Row */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-3xl font-bold text-slate-900 leading-none tracking-tight">
            {value}
          </span>
          
          {hasBadge && (
            <div className={`
              flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border
              ${hasTrend 
                ? (trend >= 0 
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                    : 'bg-rose-50 text-rose-600 border-rose-100')
                : 'bg-slate-100 text-slate-600 border-slate-200' // Neutral style for info badges
              }
            `}>
              {hasTrend && (trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />)}
              <span className="whitespace-nowrap">
                {trendLabel || (hasTrend && `${Math.abs(trend)}%`)}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StatCard;