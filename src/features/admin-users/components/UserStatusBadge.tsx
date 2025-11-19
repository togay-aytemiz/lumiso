import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { MembershipStatus } from "../types";
import { useTranslation } from "react-i18next";

interface UserStatusBadgeProps {
  status: MembershipStatus;
}

const STATUS_VARIANTS: Record<MembershipStatus, string> = {
  trial: "bg-amber-100 text-amber-900 border-amber-200",
  premium: "bg-emerald-100 text-emerald-900 border-emerald-200",
  expired: "bg-rose-100 text-rose-900 border-rose-200",
  suspended: "bg-red-100 text-red-900 border-red-200",
  complimentary: "bg-indigo-100 text-indigo-900 border-indigo-200",
  locked: "bg-rose-50 text-rose-900 border-rose-200",
};

export function UserStatusBadge({ status }: UserStatusBadgeProps) {
  const { t } = useTranslation("pages");

  return (
    <Badge variant="outline" className={cn("capitalize", STATUS_VARIANTS[status])}>
      {t(`admin.users.status.${status}`)}
    </Badge>
  );
}
