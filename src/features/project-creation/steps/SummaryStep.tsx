import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { useProjectCreationContext } from "../hooks/useProjectCreationContext";
import { cn } from "@/lib/utils";

const formatCurrency = (amount: number) => {
  try {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
      minimumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `₺${amount}`;
  }
};

export const SummaryStep = () => {
  const { t } = useTranslation("projectCreation");
  const { state } = useProjectCreationContext();

  const {
    leadSummary,
    projectSummary,
    pricingSummary,
    servicesSummary,
    notesSummary,
  } = useMemo(() => {
    const notSet = t("summary.values.notSet");
    const none = t("summary.values.none");

    const leadName = state.lead.name?.trim() ?? notSet;
    const leadContact = [state.lead.email?.trim(), state.lead.phone?.trim()]
      .filter(Boolean)
      .join(" • ");

    const projectName = state.details.name?.trim() ?? notSet;
    const projectType = state.details.projectTypeLabel?.trim() ?? notSet;
    const projectStatus = state.details.statusLabel?.trim() ?? notSet;

    const basePriceValue = parseFloat(state.details.basePrice ?? "") || 0;
    const basePriceDisplay =
      basePriceValue > 0 ? formatCurrency(basePriceValue) : none;

    const packageLabel =
      state.services.packageLabel?.trim() ??
      (state.services.packageId ? t("summary.values.packageSelected") : none);

    const services =
      state.services.selectedServices.length > 0
        ? state.services.selectedServices
        : null;

    const description = state.details.description?.trim();

    return {
      leadSummary: { leadName, leadContact },
      projectSummary: { projectName, projectType, projectStatus },
      pricingSummary: { basePriceDisplay, packageLabel },
      servicesSummary: {
        services,
        fallback: none,
      },
      notesSummary: {
        description,
        notSet,
      },
    };
  }, [state, t]);

  return (
    <div className="space-y-6 text-sm text-slate-900">
      <header className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight">
          {t("summary.sectionTitle")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("steps.summary.description")}
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        <SummaryCard
          title={t("summary.labels.lead")}
          primary={leadSummary.leadName}
          helper={leadSummary.leadContact}
        />
        <SummaryCard
          title={t("summary.labels.projectName")}
          primary={projectSummary.projectName}
          helper={
            projectSummary.projectType === projectSummary.projectStatus
              ? projectSummary.projectType
              : `${projectSummary.projectType} • ${projectSummary.projectStatus}`
          }
        />
        <SummaryCard
          title={t("summary.labels.basePrice")}
          primary={pricingSummary.basePriceDisplay}
        />
        <SummaryCard
          title={t("summary.labels.package")}
          primary={pricingSummary.packageLabel}
        />
      </section>

      <section className="space-y-3">
        <SummaryHeading>{t("summary.labels.services")}</SummaryHeading>
        {servicesSummary.services ? (
          <div className="flex flex-wrap gap-2">
            {servicesSummary.services.map((service) => (
              <Badge key={service.id} variant="secondary" className="text-xs">
                {service.name}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {servicesSummary.fallback}
          </p>
        )}
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <SummaryTextBlock
          title={t("summary.labels.description")}
          content={notesSummary.description}
          fallback={notesSummary.notSet}
        />
      </section>
    </div>
  );
};

const SummaryCard = ({
  title,
  primary,
  helper,
}: {
  title: string;
  primary: string;
  helper?: string;
}) => (
  <div className="rounded-2xl border border-border/70 bg-white/95 p-4 shadow-sm">
    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {title}
    </p>
    <p className="mt-2 text-base font-semibold text-slate-900">{primary}</p>
    {helper ? (
      <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
    ) : null}
  </div>
);

const SummaryHeading = ({ children }: { children: string }) => (
  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
    {children}
  </p>
);

const SummaryTextBlock = ({
  title,
  content,
  fallback,
}: {
  title: string;
  content?: string;
  fallback: string;
}) => (
  <div className="rounded-2xl border border-border/60 bg-white/95 p-4 shadow-sm">
    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {title}
    </p>
    <p
      className={cn(
        "mt-2 text-sm leading-relaxed",
        content ? "text-slate-900" : "text-muted-foreground"
      )}
    >
      {content ?? fallback}
    </p>
  </div>
);
