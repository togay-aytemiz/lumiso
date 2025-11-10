import type { VatMode } from "@/lib/accounting/vat";
import type { ServiceUnit } from "@/lib/services/units";

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
  depositAmount?: string;
}

export type ProjectServiceLineItemType = "existing" | "custom";

export interface ProjectServiceLineItem {
  id: string;
  type: ProjectServiceLineItemType;
  serviceId?: string;
  name: string;
  quantity: number;
  unitPrice?: number | null;
  unitCost?: number | null;
  vendorName?: string | null;
  vatRate?: number | null;
  vatMode?: VatMode;
  unit?: ServiceUnit | string | null;
  source?: "catalog" | "adhoc";
}

export interface ProjectCreationServices {
  packageId?: string;
  packageLabel?: string;
  includedItems: ProjectServiceLineItem[];
  extraItems: ProjectServiceLineItem[];
  showCustomSetup?: boolean;
}

export interface ProjectCreationMetaState {
  currentStep: ProjectCreationStepId;
  isDirty: boolean;
  entrySource?: string;
  defaultStatusId?: string | null;
  initialEntryContext?: ProjectCreationEntryContext;
  mode: "create" | "edit";
  projectId?: string;
  leadLocked?: boolean;
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
  projectId?: string;
  mode?: "create" | "edit";
  leadLocked?: boolean;
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
