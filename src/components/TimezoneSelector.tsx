import { useState, useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Clock, MapPin } from "lucide-react";
import { getSupportedTimezones, detectBrowserTimezone } from "@/lib/dateFormatUtils";

interface TimezoneSelectorProps {
  value: string;
  onValueChange: (timezone: string) => void;
  className?: string;
}

export function TimezoneSelector({ value, onValueChange, className }: TimezoneSelectorProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const timezones = getSupportedTimezones();
  
  // Group timezones by region for better organization
  const groupedTimezones = useMemo(() => {
    const filtered = timezones.filter(tz => 
      tz.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tz.value.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    const groups = filtered.reduce((acc, tz) => {
      if (!acc[tz.region]) {
        acc[tz.region] = [];
      }
      acc[tz.region].push(tz);
      return acc;
    }, {} as Record<string, typeof timezones>);
    
    // Sort regions, but put common ones first
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
  }, [timezones, searchTerm]);

  const selectedTimezone = timezones.find(tz => tz.value === value);
  const currentBrowserTz = detectBrowserTimezone();

  const handleDetectTimezone = () => {
    onValueChange(currentBrowserTz);
    setSearchTerm("");
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <Label>Timezone</Label>
      
      {/* Current Selection Display */}
      <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
        <MapPin className="h-4 w-4 text-muted-foreground" />
        <div className="flex-1">
          <p className="text-sm font-medium">
            {selectedTimezone?.label || value || 'No timezone selected'}
          </p>
          <p className="text-xs text-muted-foreground">
            Current time: {(() => {
              try {
                return new Date().toLocaleTimeString('en-US', { 
                  timeZone: value || 'UTC',
                  hour12: true,
                  hour: 'numeric',
                  minute: '2-digit'
                });
              } catch {
                return 'Invalid timezone';
              }
            })()}
          </p>
        </div>
      </div>

      {/* Auto-detect Button */}
      {currentBrowserTz && currentBrowserTz !== value && (
        <div className="flex items-center justify-between p-2 bg-blue-50 border border-blue-200 rounded-md">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-600" />
            <span className="text-sm text-blue-700">
              Detected: {timezones.find(tz => tz.value === currentBrowserTz)?.label || currentBrowserTz}
            </span>
          </div>
          <button
            type="button"
            onClick={handleDetectTimezone}
            className="text-xs text-blue-600 hover:text-blue-800 underline"
          >
            Use This
          </button>
        </div>
      )}

      {/* Timezone Selector */}
      <div className="space-y-2">
        <Input
          placeholder="Search timezones..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="text-sm"
        />
        
        <Select value={value} onValueChange={(newValue) => {
          onValueChange(newValue);
          setSearchTerm("");
        }}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a timezone..." />
          </SelectTrigger>
          <SelectContent className="max-h-60">
            {groupedTimezones.map(({ region, timezones }) => (
              <div key={region}>
                <div className="px-2 py-1 text-xs font-semibold text-muted-foreground bg-muted/50 sticky top-0">
                  {region}
                </div>
                {timezones.map((timezone) => (
                  <SelectItem 
                    key={timezone.value} 
                    value={timezone.value}
                    className="text-sm"
                  >
                    <div className="flex items-center justify-between w-full">
                      <span>{timezone.label}</span>
                      <span className="text-xs text-muted-foreground ml-2">
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
      </div>
      
      <p className="text-sm text-muted-foreground">
        This timezone will be used for notifications, reminders, and all date/time displays
      </p>
    </div>
  );
}