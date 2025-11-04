import {
  AlertTriangle,
  Bell,
  CreditCard,
  FileText,
  FolderOpen,
  Package,
  Settings,
  User,
  UserCheck,
} from "lucide-react";

export interface SettingsNavItem {
  title: string;
  href: string;
  icon: typeof User;
  testId: string;
  variant?: "danger";
}

export const personalSettingsItems: SettingsNavItem[] = [
  {
    title: "profile",
    href: "/settings/profile",
    icon: User,
    testId: "profile-section",
  },
  {
    title: "notifications",
    href: "/settings/notifications",
    icon: Bell,
    testId: "notifications-section",
  },
];

export const organizationSettingsItems: SettingsNavItem[] = [
  {
    title: "general",
    href: "/settings/general",
    icon: Settings,
    testId: "general-section",
  },
  {
    title: "projects",
    href: "/settings/projects",
    icon: FolderOpen,
    testId: "projects-section",
  },
  {
    title: "leads",
    href: "/settings/leads",
    icon: UserCheck,
    testId: "leads-section",
  },
  {
    title: "services",
    href: "/settings/services",
    icon: Package,
    testId: "services-section",
  },
  {
    title: "contracts",
    href: "/settings/contracts",
    icon: FileText,
    testId: "contracts-section",
  },
  {
    title: "billing",
    href: "/settings/billing",
    icon: CreditCard,
    testId: "billing-section",
  },
  {
    title: "dangerZone",
    href: "/settings/danger-zone",
    icon: AlertTriangle,
    testId: "danger-section",
    variant: "danger",
  },
];

export const allSettingsItems: SettingsNavItem[] = [
  ...personalSettingsItems,
  ...organizationSettingsItems,
];

export const pageMetadata: Record<
  string,
  { titleKey: string; descriptionKey?: string }
> = {
  "/settings/profile": {
    titleKey: "settings.profile.title",
    descriptionKey: "settings.profile.description",
  },
  "/settings/notifications": {
    titleKey: "settings.notifications.title",
    descriptionKey: "settings.notifications.description",
  },
  "/settings/general": {
    titleKey: "settings.general.title",
    descriptionKey: "settings.general.description",
  },
  "/settings/projects": {
    titleKey: "settings.projects.title",
    descriptionKey: "settings.projects.description",
  },
  "/settings/leads": {
    titleKey: "settings.leads.title",
    descriptionKey: "settings.leads.description",
  },
  "/settings/services": {
    titleKey: "settings.services.title",
    descriptionKey: "settings.services.description",
  },
  "/settings/contracts": {
    titleKey: "settings.contracts.title",
    descriptionKey: "settings.contracts.description",
  },
  "/settings/billing": {
    titleKey: "settings.billing.title",
    descriptionKey: "settings.billing.description",
  },
  "/settings/danger-zone": {
    titleKey: "settings.dangerZone.title",
    descriptionKey: "settings.dangerZone.description",
  },
};
