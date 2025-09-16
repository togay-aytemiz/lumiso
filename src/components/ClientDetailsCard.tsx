import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import ClientDetailsList from "@/components/ClientDetailsList";
import { useTranslation } from "react-i18next";

interface ClientDetailsCardProps {
  title?: string;
  createdAt?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  clickableNameHref?: string;
  clickableNameClasses?: string;
  showQuickActions?: boolean;
  clampNotes?: boolean;
  onNameClick?: () => void;
}

export default function ClientDetailsCard({
  title,
  createdAt,
  name,
  email,
  phone,
  notes,
  clickableNameHref,
  clickableNameClasses,
  showQuickActions = true,
  clampNotes = true,
  onNameClick,
}: ClientDetailsCardProps) {
  const { t } = useTranslation('common');
  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div>
          <CardTitle>{title || t('client.title')}</CardTitle>
          {createdAt && (
            <CardDescription className="text-xs">
              {t('client.created_on')} {new Date(createdAt).toLocaleDateString('tr-TR')}
            </CardDescription>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ClientDetailsList
          name={name}
          email={email}
          phone={phone}
          notes={notes}
          createdAt={createdAt}
          clickableNameHref={clickableNameHref}
          clickableNameClasses={clickableNameClasses}
          showQuickActions={showQuickActions}
          clampNotes={clampNotes}
          onNameClick={onNameClick}
        />
      </CardContent>
    </Card>
  );
}
