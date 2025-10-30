export type ProjectCreationStepId = "lead" | "details" | "packages" | "summary";

export interface ProjectCreationLead {
  id?: string;
  name?: string;
  email?: string;
  phone?: string;
  notes?: string;
  mode: "existing" | "new";
}

export interface ProjectCreationDetails {
  name?: string;
  description?: string;
  projectTypeId?: string;
  projectTypeLabel?: string;
  statusId?: string;
  statusLabel?: string;
  basePrice?: string;
}

export interface ProjectCreationServices {
  packageId?: string;
  packageLabel?: string;
  selectedServiceIds: string[];
  selectedServices: Array<{
    id: string;
    name: string;
    category?: string | null;
    cost_price?: number;
    selling_price?: number;
  }>;
  showCustomSetup?: boolean;
}

export interface ProjectCreationMetaState {
  currentStep: ProjectCreationStepId;
  isDirty: boolean;
  entrySource?: string;
  defaultStatusId?: string | null;
  initialEntryContext?: ProjectCreationEntryContext;
}

export interface ProjectCreationState {
  lead: ProjectCreationLead;
  details: ProjectCreationDetails;
  services: ProjectCreationServices;
  meta: ProjectCreationMetaState;
}

export interface ProjectCreationEntryContext {
  leadId?: string;
  leadName?: string;
  entrySource?: string;
  defaultStatusId?: string | null;
  startStepOverride?: ProjectCreationStepId;
}

export type ProjectCreationAction =
  | { type: "LOAD_ENTRY_CONTEXT"; payload: ProjectCreationEntryContext }
  | { type: "SET_STEP"; payload: ProjectCreationStepId }
  | { type: "UPDATE_LEAD"; payload: ProjectCreationLead; markDirty?: boolean }
  | {
      type: "UPDATE_DETAILS";
      payload: Partial<ProjectCreationDetails>;
      markDirty?: boolean;
    }
  | {
      type: "UPDATE_SERVICES";
      payload: Partial<ProjectCreationServices>;
      markDirty?: boolean;
    }
  | { type: "MARK_DIRTY"; payload: boolean }
  | { type: "RESET"; payload?: ProjectCreationEntryContext };
