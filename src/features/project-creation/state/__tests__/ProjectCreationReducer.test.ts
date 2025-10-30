import {
  createInitialProjectCreationState,
  projectCreationReducer,
} from "../projectCreationReducer";
import type { ProjectCreationState } from "../../types";

const reduce = (
  state: ProjectCreationState,
  action: Parameters<typeof projectCreationReducer>[1]
) => projectCreationReducer(state, action);

describe("projectCreationReducer initialisation", () => {
  it("starts on the lead step by default", () => {
    const state = createInitialProjectCreationState();
    expect(state.meta.currentStep).toBe("lead");
    expect(state.meta.isDirty).toBe(false);
  });

  it("prefills lead context and advances to details when leadId provided", () => {
    const state = createInitialProjectCreationState({
      leadId: "lead-123",
      leadName: "Taylor",
    });

    expect(state.lead.id).toBe("lead-123");
    expect(state.lead.name).toBe("Taylor");
    expect(state.meta.currentStep).toBe("details");
    expect(state.meta.isDirty).toBe(false);
    expect(state.meta.initialEntryContext).toEqual({
      leadId: "lead-123",
      leadName: "Taylor",
    });
  });

  it("honours explicit start step overrides even with context", () => {
    const state = createInitialProjectCreationState({
      leadId: "lead-123",
      startStepOverride: "packages",
    });

    expect(state.meta.currentStep).toBe("packages");
  });
});

describe("projectCreationReducer mutations", () => {
  it("preserves the initial entry context when state mutates", () => {
    const base = createInitialProjectCreationState({
      leadId: "lead-77",
      leadName: "Avery",
    });

    const dirty = reduce(base, {
      type: "UPDATE_DETAILS",
      payload: { name: "Spring Wedding" },
    });

    expect(dirty.meta.initialEntryContext).toEqual({
      leadId: "lead-77",
      leadName: "Avery",
    });
  });

  it("allows system updates without marking the wizard dirty", () => {
    const base = createInitialProjectCreationState();
    const updated = reduce(base, {
      type: "UPDATE_DETAILS",
      payload: { statusId: "status-123" },
      markDirty: false,
    });

    expect(updated.details.statusId).toBe("status-123");
    expect(updated.meta.isDirty).toBe(false);
  });

  it("marks state dirty when updating lead", () => {
    const base = createInitialProjectCreationState();
    const updated = reduce(base, {
      type: "UPDATE_LEAD",
      payload: { id: "lead-1", name: "Morgan", mode: "existing" },
    });

    expect(updated.lead.name).toBe("Morgan");
    expect(updated.meta.isDirty).toBe(true);
  });

  it("persists service selections while merging updates", () => {
    const base = createInitialProjectCreationState();
    const withServices = reduce(base, {
      type: "UPDATE_SERVICES",
      payload: {
        selectedServiceIds: ["svc-1"],
        selectedServices: [{ id: "svc-1", name: "Timeline planning" }],
      },
    });

    const toggled = reduce(withServices, {
      type: "UPDATE_SERVICES",
      payload: {
        packageId: "pkg-basic",
        packageLabel: "Basic package",
        showCustomSetup: true,
      },
    });

    expect(toggled.services.selectedServiceIds).toEqual(["svc-1"]);
    expect(toggled.services.packageLabel).toBe("Basic package");
    expect(toggled.meta.isDirty).toBe(true);
  });

  it("resets to a clean state when RESET is dispatched", () => {
    const base = createInitialProjectCreationState();
    const dirty = reduce(base, {
      type: "UPDATE_DETAILS",
      payload: { name: "Autumn Wedding" },
    });
    expect(dirty.meta.isDirty).toBe(true);
    expect(dirty.meta.initialEntryContext).toBeUndefined();

    const reset = reduce(dirty, {
      type: "RESET",
      payload: { leadId: "lead-42", leadName: "Jordan" },
    });

    expect(reset.meta.isDirty).toBe(false);
    expect(reset.lead.id).toBe("lead-42");
    expect(reset.meta.currentStep).toBe("details");
    expect(reset.meta.initialEntryContext).toEqual({
      leadId: "lead-42",
      leadName: "Jordan",
    });
  });
});
