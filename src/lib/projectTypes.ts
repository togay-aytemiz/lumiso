type ProjectTypeLocale = "en" | "tr";

type ProjectTypeTemplate = {
  en: string;
  tr: string;
};

const TEMPLATE_LABELS: Record<string, ProjectTypeTemplate> = {
  wedding: { en: "Wedding", tr: "Düğün" },
  family: { en: "Family", tr: "Aile" },
  children: { en: "Children", tr: "Çocuk" },
  maternity: { en: "Maternity", tr: "Hamilelik" },
  birth: { en: "Birth", tr: "Doğum" },
  newborn: { en: "Newborn", tr: "Yenidoğan" },
  headshots: { en: "Headshots", tr: "Portre" },
  senior: { en: "Senior", tr: "Mezuniyet" },
  commercial: { en: "Commercial", tr: "Ticari" },
  event: { en: "Event", tr: "Etkinlik" },
  pet: { en: "Pet", tr: "Evcil Hayvan" },
  real_estate: { en: "Real Estate", tr: "Gayrimenkul" }
};

const normalize = (value?: string | null) => (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");

const baseLocale = (locale?: string | null): ProjectTypeLocale => {
  const candidate = (locale ?? "en").split("-")[0].toLowerCase();
  return candidate === "tr" ? "tr" : "en";
};

interface ProjectTypeLike {
  name: string | null;
  template_slug?: string | null;
}

/**
 * Returns a localized display name for a seeded project type while respecting user overrides.
 * If the user renamed the type, we keep their name. If the name still matches the template slug
 * or the English default, we swap in the localized label for the active locale.
 */
export const getDisplayProjectTypeName = (type: ProjectTypeLike, locale?: string | null): string => {
  const templateSlug = type.template_slug?.toLowerCase();
  const template = templateSlug ? TEMPLATE_LABELS[templateSlug] : undefined;

  if (!template) {
    return type.name ?? "";
  }

  const currentLocale = baseLocale(locale);
  const localized = template[currentLocale];
  const englishNormalized = normalize(template.en);
  const slugNormalized = normalize(templateSlug);
  const nameNormalized = normalize(type.name);

  const isUneditedDefault =
    nameNormalized === englishNormalized || nameNormalized === slugNormalized || nameNormalized.length === 0;

  if (currentLocale !== "en" && isUneditedDefault) {
    return localized;
  }

  return type.name ?? localized ?? template.en;
};
