import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { ProjectCreationWizardSheet } from "../ProjectCreationWizardSheet";
import { useProjectCreationContext } from "../../hooks/useProjectCreationContext";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock("@/components/ui/app-sheet-modal", () => ({
  AppSheetModal: ({
    children,
  }: {
    children: ReactNode;
  }) => <div data-testid="modal">{children}</div>,
}));

jest.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

jest.mock("@/contexts/OnboardingContext", () => ({
  useOnboarding: () => ({
    currentStep: "project-wizard",
    shouldLockNavigation: false,
    completeCurrentStep: jest.fn(),
  }),
}));

jest.mock("@/lib/telemetry", () => ({
  trackEvent: jest.fn(),
}));

jest.mock("@/lib/organizationUtils", () => ({
  getUserOrganizationId: jest.fn().mockResolvedValue("org-123"),
}));

jest.mock("@/lib/payments/outstanding", () => ({
  syncProjectOutstandingPayment: jest.fn().mockResolvedValue(undefined),
  recalculateProjectOutstanding: jest.fn(),
}));

jest.mock("../ProjectCreationWizard", () => ({
  ProjectCreationWizard: jest.fn(() => {
    const { state } = useProjectCreationContext();
    return <div data-testid="wizard-step">{state.meta.currentStep}</div>;
  }),
}));

describe("ProjectCreationWizardSheet initial step selection", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("starts on the lead step by default", () => {
    render(
      <ProjectCreationWizardSheet
        isOpen
        onOpenChange={jest.fn()}
      />
    );

    expect(screen.getByTestId("wizard-step")).toHaveTextContent("lead");
  });

  it("advances to details when lead context is provided", () => {
    render(
      <ProjectCreationWizardSheet
        isOpen
        onOpenChange={jest.fn()}
        leadId="lead-001"
        leadName="Jordan"
      />
    );

    expect(screen.getByTestId("wizard-step")).toHaveTextContent("details");
  });

  it("honours a start step override", () => {
    render(
      <ProjectCreationWizardSheet
        isOpen
        onOpenChange={jest.fn()}
        leadId="lead-001"
        startStepOverride="packages"
      />
    );

    expect(screen.getByTestId("wizard-step")).toHaveTextContent("packages");
  });
});
