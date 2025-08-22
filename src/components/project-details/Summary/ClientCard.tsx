import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import ClientDetailsList from "@/components/ClientDetailsList";
import { useNavigate } from "react-router-dom";
interface ClientCardProps {
  createdAt?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  leadId: string;
}
export default function ClientCard({
  createdAt,
  name,
  email,
  phone,
  notes,
  leadId
}: ClientCardProps) {
  const navigate = useNavigate();

  const handleNameClick = () => {
    navigate(`/leads/${leadId}`);
  };

  return <Card className="rounded-2xl border bg-white shadow-sm">
      <CardHeader className="px-4 pt-4 pb-3">
        <h2 className="text-lg font-semibold sm:text-xl text-left">Client Details</h2>
        {createdAt && <CardDescription className="text-xs">Created on {new Date(createdAt).toLocaleDateString('tr-TR')}</CardDescription>}
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <ClientDetailsList 
          name={name} 
          email={email} 
          phone={phone} 
          notes={notes} 
          onNameClick={handleNameClick}
          clickableNameClasses="text-blue-600 hover:text-blue-800 hover:underline" 
          showQuickActions 
          clampNotes 
        />
      </CardContent>
    </Card>;
}