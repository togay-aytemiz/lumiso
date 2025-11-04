// Settings design tokens shared across the modal shell. Animation utilities live in
// `src/index.css` (see docs/settings-experience-plan.md) to keep transitions centralized.
export const settingsClasses = {
  eyebrow: "settings-eyebrow text-muted-foreground",
  headerTitle: "settings-header-title text-foreground",
  headerDescription: "settings-header-description",
  railSectionLabel: "settings-rail-section-label text-muted-foreground",
  anchorPill: "settings-anchor-pill",
  anchorPillActive: "settings-anchor-pill settings-anchor-pill-active",
};

export const settingsTokens = {
  railWidth: "18rem",
  overlayShadow: "0 30px 80px rgba(15, 23, 42, 0.18)",
};

export type SettingsAnchor = {
  id: string;
  label: string;
};
