import type {
  ProjectCreationDelivery,
  ProjectDeliveryMethodSelection,
} from "../types";
import type {
  ProjectPackageDeliverySnapshot,
  ProjectPackageDeliveryMethodSnapshot,
} from "@/lib/projects/projectPackageSnapshot";

const normalizeInteger = (
  value: number | null | undefined,
  options: { allowZero?: boolean; fallback?: number | null } = {}
): number | null => {
  if (value === null || value === undefined) {
    return options.fallback ?? null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return options.fallback ?? null;
  }
  const rounded = Math.trunc(parsed);
  if (!options.allowZero && rounded <= 0) {
    return options.fallback ?? null;
  }
  return rounded;
};

const mapMethodSnapshots = (
  methods: ProjectPackageDeliveryMethodSnapshot[] | undefined
): ProjectDeliveryMethodSelection[] =>
  (methods ?? [])
    .filter((method): method is ProjectPackageDeliveryMethodSnapshot & { methodId: string } =>
      Boolean(method?.methodId)
    )
    .map((method) => ({
      methodId: method.methodId,
      name: method.name ?? method.methodId,
    }));

export const createDefaultProjectDeliveryState = (): ProjectCreationDelivery => ({
  enabled: false,
  enablePhotoEstimate: false,
  estimateType: "single",
  countMin: null,
  countMax: null,
  enableLeadTime: false,
  leadTimeValue: null,
  leadTimeUnit: "days",
  enableMethods: false,
  methods: [],
});

export const deriveDeliveryStateFromSnapshot = (
  snapshot: ProjectPackageDeliverySnapshot | null | undefined
): ProjectCreationDelivery => {
  if (!snapshot) {
    return createDefaultProjectDeliveryState();
  }

  const estimateType = snapshot.estimateType === "range" ? "range" : "single";
  const photosEnabled =
    snapshot.photosEnabled ??
    Boolean(
      (snapshot.photoCountMin ?? null) !== null ||
        (estimateType === "range" && (snapshot.photoCountMax ?? null) !== null)
    );
  const leadTimeEnabled =
    snapshot.leadTimeEnabled ?? Boolean(snapshot.leadTimeValue ?? null);
  const methodsEnabled =
    snapshot.methodsEnabled ?? ((snapshot.methods?.length ?? 0) > 0);

  return {
    enabled: photosEnabled || leadTimeEnabled || methodsEnabled,
    enablePhotoEstimate: photosEnabled,
    estimateType,
    countMin: photosEnabled ? snapshot.photoCountMin ?? null : null,
    countMax:
      photosEnabled && estimateType === "range"
        ? snapshot.photoCountMax ?? null
        : null,
    enableLeadTime: leadTimeEnabled,
    leadTimeValue: leadTimeEnabled ? snapshot.leadTimeValue ?? null : null,
    leadTimeUnit:
      leadTimeEnabled && snapshot.leadTimeUnit === "weeks" ? "weeks" : "days",
    enableMethods: methodsEnabled,
    methods: methodsEnabled ? mapMethodSnapshots(snapshot.methods) : [],
  };
};

const hasDeliveryValue = (state: ProjectCreationDelivery): boolean => {
  if (state.enabled === false) return false;
  if (state.enablePhotoEstimate && state.countMin) return true;
  if (state.enablePhotoEstimate && state.estimateType === "range" && state.countMax) {
    return true;
  }
  if (state.enableLeadTime && state.leadTimeValue != null) return true;
  if (state.enableMethods && state.methods.length > 0) return true;
  return false;
};

export const buildDeliverySnapshotFromState = (
  state: ProjectCreationDelivery,
  fallback?: ProjectPackageDeliverySnapshot | null
): ProjectPackageDeliverySnapshot | null => {
  if (!state.enabled || !hasDeliveryValue(state)) {
    return null;
  }

  const estimateType = state.estimateType === "range" ? "range" : "single";
  const photosEnabled = state.enablePhotoEstimate !== false;
  const leadTimeEnabled = state.enableLeadTime !== false;
  const methodsEnabled = state.enableMethods !== false;

  const photoCountMin = photosEnabled ? normalizeInteger(state.countMin) : null;
  const photoCountMax =
    photosEnabled && estimateType === "range"
      ? normalizeInteger(state.countMax)
      : null;
  const leadTimeValue = leadTimeEnabled
    ? normalizeInteger(state.leadTimeValue, { allowZero: true })
    : null;
  const leadTimeUnit =
    leadTimeEnabled && leadTimeValue !== null
      ? state.leadTimeUnit ?? fallback?.leadTimeUnit ?? "days"
      : null;

  const methods = methodsEnabled
    ? state.methods.map((method) => ({
        methodId: method.methodId,
        name: method.name ?? method.methodId,
      }))
    : [];

  return {
    estimateType,
    photoCountMin,
    photoCountMax,
    leadTimeValue,
    leadTimeUnit,
    methods,
    photosEnabled,
    leadTimeEnabled,
    methodsEnabled,
  };
};
