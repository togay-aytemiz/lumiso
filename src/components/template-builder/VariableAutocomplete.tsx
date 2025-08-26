import { useState, useEffect } from "react";
import { Search, Hash } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface VariableAutocompleteProps {
  onVariableSelect: (variable: string) => void;
  className?: string;
}

const VARIABLE_GROUPS = [
  {
    name: "Client Information",
    variables: [
      { key: "customer_name", label: "Customer Name", example: "John Smith" },
      { key: "customer_email", label: "Customer Email", example: "john@example.com" },
      { key: "customer_phone", label: "Customer Phone", example: "(555) 123-4567" },
      { key: "customer_address", label: "Customer Address", example: "123 Main St" }
    ]
  },
  {
    name: "Session Details",
    variables: [
      { key: "session_date", label: "Session Date", example: "March 15, 2024" },
      { key: "session_time", label: "Session Time", example: "2:00 PM" },
      { key: "session_location", label: "Session Location", example: "Downtown Studio" },
      { key: "session_type", label: "Session Type", example: "Wedding Photography" },
      { key: "session_duration", label: "Session Duration", example: "3 hours" }
    ]
  },
  {
    name: "Studio Information",
    variables: [
      { key: "studio_name", label: "Studio Name", example: "Dream Photography" },
      { key: "studio_phone", label: "Studio Phone", example: "(555) 987-6543" },
      { key: "studio_email", label: "Studio Email", example: "hello@dreamphotography.com" },
      { key: "studio_address", label: "Studio Address", example: "456 Studio Lane" },
      { key: "studio_website", label: "Studio Website", example: "www.dreamphotography.com" }
    ]
  },
  {
    name: "Project Details",
    variables: [
      { key: "project_title", label: "Project Title", example: "Smith Wedding 2024" },
      { key: "project_status", label: "Project Status", example: "In Progress" },
      { key: "project_deadline", label: "Project Deadline", example: "April 1, 2024" },
      { key: "project_package", label: "Project Package", example: "Premium Wedding" }
    ]
  },
  {
    name: "Payment & Booking",
    variables: [
      { key: "total_amount", label: "Total Amount", example: "$2,500.00" },
      { key: "deposit_amount", label: "Deposit Amount", example: "$500.00" },
      { key: "balance_due", label: "Balance Due", example: "$2,000.00" },
      { key: "booking_date", label: "Booking Date", example: "February 10, 2024" },
      { key: "payment_due_date", label: "Payment Due Date", example: "March 1, 2024" }
    ]
  }
];

export function VariableAutocomplete({ onVariableSelect, className }: VariableAutocompleteProps) {
  const [search, setSearch] = useState("");
  const [filteredGroups, setFilteredGroups] = useState(VARIABLE_GROUPS);

  useEffect(() => {
    if (!search.trim()) {
      setFilteredGroups(VARIABLE_GROUPS);
      return;
    }

    const searchLower = search.toLowerCase();
    const filtered = VARIABLE_GROUPS.map(group => ({
      ...group,
      variables: group.variables.filter(
        variable =>
          variable.key.toLowerCase().includes(searchLower) ||
          variable.label.toLowerCase().includes(searchLower)
      )
    })).filter(group => group.variables.length > 0);

    setFilteredGroups(filtered);
  }, [search]);

  return (
    <Card className={cn("w-full max-w-md", className)}>
      <CardContent className="p-3">
        <div className="relative mb-3">
          <Search className="absolute left-2 top-2.5 h-3 w-3 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search variables..."
            className="pl-7 h-8 text-sm"
          />
        </div>
        
        <ScrollArea className="h-64">
          <div className="space-y-3">
            {filteredGroups.map(group => (
              <div key={group.name}>
                <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                  {group.name}
                </h4>
                <div className="space-y-1">
                  {group.variables.map(variable => (
                    <div
                      key={variable.key}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 cursor-pointer group"
                      onClick={() => onVariableSelect(variable.key)}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Hash className="h-3 w-3 text-primary flex-shrink-0" />
                        <div className="min-w-0">
                          <div className="font-medium text-sm truncate">
                            {variable.label}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {'{' + variable.key + '}'}
                          </div>
                        </div>
                      </div>
                      <Badge variant="outline" className="ml-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                        Insert
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            
            {filteredGroups.length === 0 && (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">No variables found</p>
              </div>
            )}
          </div>
        </ScrollArea>
        
        <div className="mt-3 pt-3 border-t">
          <p className="text-xs text-muted-foreground">
            Click any variable to insert it at your cursor position
          </p>
        </div>
      </CardContent>
    </Card>
  );
}