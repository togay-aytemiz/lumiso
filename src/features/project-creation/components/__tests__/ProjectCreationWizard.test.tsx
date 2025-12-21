import { useEffect, type ComponentProps } from "react";
import { fireEvent, render, screen, waitFor } from "@/utils/testUtils";
import { ProjectCreationWizard } from "../ProjectCreationWizard";
import { ProjectCreationProvider } from "../../context/ProjectCreationProvider";
import { useProjectCreationActions } from "../../hooks/useProjectCreationActions";

const toastMock = jest.fn();

jest.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

jest.mock("@/contexts/OrganizationContext", () => ({
  useOrganization: () => ({ activeOrganization: { id: "org-1" } }),
}));

jest.mock("@/contexts/useOnboarding", () => ({
  useOnboarding: () => ({
    currentStep: 0,
    shouldLockNavigation: false,
    completeCurrentStep: jest.fn(),
  }),
}));

jest.mock("@/hooks/useProfile", () => ({
  useProfile: () => ({ profile: { id: "profile-1" } }),
}));

jest.mock("@/lib/telemetry", () => ({
  trackEvent: jest.fn(),
}));

jest.mock("@/lib/payments/outstanding", () => ({
  syncProjectOutstandingPayment: jest.fn().mockResolvedValue(undefined),
  recalculateProjectOutstanding: jest.fn(),
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const PrefillLeadAndDetails = () => {
  const { updateLead, updateDetails } = useProjectCreationActions();

  useEffect(() => {
    updateLead({ id: "lead-1", name: "Jamie", mode: "existing" });
    updateDetails({
      name: "Autumn Wedding",
      projectTypeId: "type-1",
      projectTypeLabel: "Wedding",
    });
  }, [updateLead, updateDetails]);

  return null;
};

const renderWizard = (props?: Partial<ComponentProps<typeof ProjectCreationWizard>>) =>
  render(
    <ProjectCreationProvider>
      <ProjectCreationWizard onComplete={jest.fn()} onCancel={jest.fn()} {...props} />
    </ProjectCreationProvider>
  );

describe("ProjectCreationWizard navigation", () => {
  beforeEach(() => {
    toastMock.mockClear();
  });

  it("shows validation toast when attempting to advance without selecting a lead", () => {
    renderWizard();

    fireEvent.click(screen.getByRole("button", { name: "wizard.next" }));

    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: "validation.lead.title" })
    );
  });

  it("advances to details step when lead is present", async () => {
    render(
      <ProjectCreationProvider>
        <PrefillLeadAndDetails />
        <ProjectCreationWizard onComplete={jest.fn()} onCancel={jest.fn()} />
      </ProjectCreationProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("steps.lead.heading")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "wizard.next" }));

    await waitFor(() => {
      expect(screen.getByText("steps.details.heading")).toBeInTheDocument();
    });

    expect(toastMock).not.toHaveBeenCalled();
  });
});
