import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import ClientDetailsList from "@/components/ClientDetailsList";

interface ClientCardProps {
  createdAt?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  leadId: string;
}

export default function ClientCard({ createdAt, name, email, phone, notes, leadId }: ClientCardProps) {
  return (
    <Card className="rounded-2xl border bg-white shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle>Client Details</CardTitle>
        {createdAt && (
          <CardDescription className="text-xs">Created on {new Date(createdAt).toLocaleDateString('tr-TR')}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <ClientDetailsList
          name={name}
          email={email}
          phone={phone}
          notes={notes}
          clickableNameHref={`/leads/${leadId}`}
          clickableNameClasses="text-blue-600 hover:text-blue-800 hover:underline"
          showQuickActions
          clampNotes
        />
      </CardContent>
    </Card>
  );
}
