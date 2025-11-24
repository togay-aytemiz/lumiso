export type ServiceType = "coverage" | "deliverable";

export type DefaultCategoryDefinition = {
  value: string;
  translationKey: string;
};

export const DEFAULT_CATEGORY_DEFINITIONS: Record<ServiceType, DefaultCategoryDefinition[]> = {
  coverage: [
    { value: "Lead Photographer", translationKey: "service.categories.coverage.lead_photographer" },
    { value: "Second Photographer", translationKey: "service.categories.coverage.second_photographer" },
    { value: "Assistant Photographer", translationKey: "service.categories.coverage.assistant_photographer" },
    { value: "Videographer", translationKey: "service.categories.coverage.videographer" },
    { value: "Drone Operator", translationKey: "service.categories.coverage.drone_operator" },
    { value: "Production Crew", translationKey: "service.categories.coverage.production_crew" },
    { value: "Hair & Makeup", translationKey: "service.categories.coverage.hair_makeup" },
  ],
  deliverable: [
    { value: "Albums", translationKey: "service.categories.deliverable.albums" },
    { value: "Prints", translationKey: "service.categories.deliverable.prints" },
    { value: "Digital", translationKey: "service.categories.deliverable.digital" },
    { value: "Retouching", translationKey: "service.categories.deliverable.retouching" },
    { value: "Frames", translationKey: "service.categories.deliverable.frames" },
    { value: "Extras", translationKey: "service.categories.deliverable.extras" },
    { value: "Packages", translationKey: "service.categories.deliverable.packages" },
  ],
};

export const DEFAULT_CATEGORIES: Record<ServiceType, string[]> = {
  coverage: DEFAULT_CATEGORY_DEFINITIONS.coverage.map((definition) => definition.value),
  deliverable: DEFAULT_CATEGORY_DEFINITIONS.deliverable.map((definition) => definition.value),
};

export const DEFAULT_CATEGORY_TRANSLATION_MAP: Record<ServiceType, Record<string, string>> = {
  coverage: DEFAULT_CATEGORY_DEFINITIONS.coverage.reduce<Record<string, string>>((acc, definition) => {
    acc[definition.value] = definition.translationKey;
    return acc;
  }, {}),
  deliverable: DEFAULT_CATEGORY_DEFINITIONS.deliverable.reduce<Record<string, string>>((acc, definition) => {
    acc[definition.value] = definition.translationKey;
    return acc;
  }, {}),
};
