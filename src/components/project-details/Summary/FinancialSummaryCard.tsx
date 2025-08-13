import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface FinancialSummaryCardProps {
  onAddPaymentClick?: () => void;
}

export default function FinancialSummaryCard({ onAddPaymentClick }: FinancialSummaryCardProps) {
  return (
    <Card className="rounded-2xl border bg-white shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Financial Summary</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="text-sm text-muted-foreground mb-3">See detailed breakdown in Payments.</div>
        <Button size="sm" onClick={onAddPaymentClick} className="gap-2">
          <Plus className="h-4 w-4" />
          Add
        </Button>
      </CardContent>
    </Card>
  );
}
