import { ShieldAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Button } from "@/components/ui/button";

export function SuspendedAccountOverlay() {
  const { activeOrganization } = useOrganization();
  const { t } = useTranslation("pages", { keyPrefix: "admin.suspensionOverlay" });

  if (activeOrganization?.membership_status !== "suspended") {
    return null;
  }

  const reason = activeOrganization.manual_flag_reason?.trim() || null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-background/90 backdrop-blur-sm px-4">
      <div className="w-full max-w-lg space-y-6 rounded-3xl border border-destructive/30 bg-card/95 p-8 text-center shadow-2xl">
        <div className="flex flex-col items-center gap-3">
          <ShieldAlert className="h-12 w-12 text-destructive" />
          <div className="space-y-2">
            <p className="text-2xl font-semibold text-foreground">
              {t("title")}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("description")}
            </p>
          </div>
        </div>
        {reason ? (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-left">
            <p className="text-xs font-semibold uppercase tracking-wide text-destructive">
              {t("reasonLabel")}
            </p>
            <p className="mt-2 text-sm text-destructive">{reason}</p>
          </div>
        ) : null}
        <Button
          size="lg"
          className="w-full"
          onClick={() => {
            window.open("mailto:support@lumiso.com", "_self");
          }}
        >
          {t("contactSupport")}
        </Button>
      </div>
    </div>
  );
}
