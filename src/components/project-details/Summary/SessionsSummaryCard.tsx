import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SessionsSummaryCardProps {
  count: number;
  onViewAll: () => void;
}

export default function SessionsSummaryCard({ count, onViewAll }: SessionsSummaryCardProps) {
  return (
    <Card className="rounded-2xl border bg-white shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Sessions</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {count} session{count === 1 ? '' : 's'}
          </div>
          <button onClick={onViewAll} className="text-sm hover:underline underline-offset-4">View all</button>
        </div>
      </CardContent>
    </Card>
  );
}
