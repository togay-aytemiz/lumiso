import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NotebookPen, ListTodo, Wrench } from "lucide-react";

interface QuickActionsCardProps {
  onAddNote: () => void;
  onAddTodo: () => void;
  onAddService: () => void;
}

export default function QuickActionsCard({ onAddNote, onAddTodo, onAddService }: QuickActionsCardProps) {
  return (
    <Card className="rounded-2xl border bg-white shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" onClick={onAddNote}><NotebookPen className="h-4 w-4 mr-1" />+ Note</Button>
          <Button variant="ghost" size="sm" onClick={onAddTodo}><ListTodo className="h-4 w-4 mr-1" />+ Todo</Button>
          <Button variant="ghost" size="sm" onClick={onAddService}><Wrench className="h-4 w-4 mr-1" />+ Service</Button>
        </div>
      </CardContent>
    </Card>
  );
}
