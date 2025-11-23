import { useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Clock } from "lucide-react";
import { getSupportedTimezones, detectBrowserTimezone } from "@/lib/dateFormatUtils";
import { useTranslation } from "react-i18next";

interface TimezoneSelectorProps {
  value: string;
  onValueChange: (timezone: string) => void;
  className?: string;
}

export function TimezoneSelector({ value, onValueChange, className }: TimezoneSelectorProps) {
  const timezones = getSupportedTimezones();
  const { t } = useTranslation("common");
  
  // Group timezones by region for better organization
  const groupedTimezones = useMemo(() => {
    const groups = timezones.reduce((acc, tz) => {
      if (!acc[tz.region]) {
        acc[tz.region] = [];
      }
      acc[tz.region].push(tz);
      return acc;
    }, {} as Record<string, typeof timezones>);
    
    // Sort regions, put common ones first
    const regionOrder = ['America', 'Europe', 'Asia', 'Australia', 'Africa', 'Pacific', 'UTC'];
    const sortedGroups = Object.keys(groups).sort((a, b) => {
      const aIndex = regionOrder.indexOf(a);
      const bIndex = regionOrder.indexOf(b);
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      return a.localeCompare(b);
    });
    
    return sortedGroups.map(region => ({
      region,
      timezones: groups[region]
    }));
  }, [timezones]);

  const selectedTimezone = timezones.find(tz => tz.value === value);
  const currentBrowserTz = detectBrowserTimezone();

  const getCurrentTime = (timezone: string) => {
    try {
      return new Date().toLocaleTimeString('en-US', { 
        timeZone: timezone,
        hour12: true,
        hour: 'numeric',
        minute: '2-digit'
      });
    } catch {
      return 'Invalid timezone';
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <Label htmlFor="timezone-select">{t("timezone.label")}</Label>
      
      {/* Current Selection Display */}
      <div className="flex items-center gap-3 p-3 bg-muted/20 rounded-lg border">
        <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">
            {selectedTimezone?.label || t("timezone.fallback")}
          </p>
          <p className="text-xs text-muted-foreground">
            {t("timezone.currentTime", { time: getCurrentTime(value || 'UTC') })}
          </p>
        </div>
        {currentBrowserTz && currentBrowserTz !== value && (
          <div className="flex items-center gap-1 text-xs text-blue-600">
            <Clock className="h-3 w-3" />
            <button
              type="button"
              onClick={() => onValueChange(currentBrowserTz)}
              className="hover:underline"
              title={t("timezone.autoDetectTitle", { timezone: timezones.find(tz => tz.value === currentBrowserTz)?.label || currentBrowserTz })}
            >
              {t("timezone.autoDetect")}
            </button>
          </div>
        )}
      </div>

      {/* Timezone Dropdown */}
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger id="timezone-select" className="w-full">
          <SelectValue placeholder={t("timezone.placeholder")} />
        </SelectTrigger>
        <SelectContent className="max-h-64">
          {groupedTimezones.map(({ region, timezones }) => (
            <div key={region}>
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/30 sticky top-0 z-10">
                {region}
              </div>
              {timezones.map((timezone) => (
                <SelectItem 
                  key={timezone.value} 
                  value={timezone.value}
                  className="text-sm py-2"
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="truncate">{timezone.label}</span>
                    <span className="text-xs text-muted-foreground ml-2 flex-shrink-0">
                      {(() => {
                        try {
                          return new Date().toLocaleTimeString('en-US', { 
                            timeZone: timezone.value,
                            hour12: false,
                            hour: '2-digit',
                            minute: '2-digit'
                          });
                        } catch {
                          return '--:--';
                        }
                      })()}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </div>
          ))}
        </SelectContent>
      </Select>
      
      <p className="text-xs text-muted-foreground">
        {t("timezone.helper")}
      </p>
    </div>
  );
}
