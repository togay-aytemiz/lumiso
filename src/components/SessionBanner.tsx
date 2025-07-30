import { Calendar, Clock, Badge as BadgeIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

interface Session {
  id: string;
  session_date: string;
  session_time: string;
  notes: string;
  status: string;
}

interface SessionBannerProps {
  session: Session;
  leadName: string;
}

const SessionBanner = ({ session, leadName }: SessionBannerProps) => {
  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'scheduled': return 'default';
      case 'completed': return 'secondary';
      case 'cancelled': return 'destructive';
      default: return 'outline';
    }
  };

  return (
    <Card className="border-l-4 border-l-primary bg-primary/5">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <h3 className="font-semibold text-lg">{leadName} - Photo Session</h3>
              <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  <span>{new Date(session.session_date).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  <span>{session.session_time}</span>
                </div>
              </div>
            </div>
          </div>
          <Badge variant={getStatusBadgeVariant(session.status)} className="capitalize">
            {session.status}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
};

export default SessionBanner;