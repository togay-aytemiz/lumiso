// Settings design tokens shared across the modal shell. Animation utilities live in
// `src/index.css` (see docs/settings-experience-plan.md) to keep transitions centralized.
export const settingsClasses = {
  eyebrow: "settings-eyebrow text-muted-foreground",
  headerTitle: "settings-header-title text-foreground",
  headerDescription: "settings-header-description",
  railSectionLabel: "settings-rail-section-label text-muted-foreground",
  anchorPill: "settings-anchor-pill",
  anchorPillActive: "settings-anchor-pill settings-anchor-pill-active",
  sectionSurface: "settings-section-surface",
  sectionTitle: "settings-section-title text-foreground",
  sectionDescription: "settings-section-description",
};

export const settingsTokens = {
  railWidth: "18rem",
  overlayShadow: "0 30px 80px rgba(15, 23, 42, 0.18)",
  section: {
    padding: "px-5 py-6 sm:px-6 sm:py-7 lg:px-8 lg:py-8",
    gap: "gap-6 md:gap-10",
    contentGap: "space-y-6",
    singleColumnStack: "space-y-5",
    actionGap: "gap-3",
    twoColumnTemplate:
      "md:grid-cols-[minmax(0,240px)_minmax(0,1fr)] lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)]",
  },
};

export type SettingsAnchor = {
  id: string;
  label: string;
};
