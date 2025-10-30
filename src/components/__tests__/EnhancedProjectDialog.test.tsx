import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { EnhancedProjectDialog } from "../EnhancedProjectDialog";

const sheetMock = jest.fn((props: any) => {
  latestSheetProps = props;
  return props.isOpen ? <div data-testid="project-creation-sheet" /> : null;
});

let latestSheetProps: any = null;

jest.mock("@/features/project-creation", () => ({
  ProjectCreationWizardSheet: (props: any) => sheetMock(props),
}));

jest.mock("react-i18next", () => ({
  useTranslation: (ns?: string) => ({
    t: (key: string) =>
      ns ? `${ns}:${key}` : key,
  }),
}));

describe("EnhancedProjectDialog (wizard wrapper)", () => {
  beforeEach(() => {
    latestSheetProps = null;
    sheetMock.mockClear();
  });

  it("renders fallback button trigger when no children provided", () => {
    render(<EnhancedProjectDialog />);
    expect(
      screen.getByRole("button", { name: "forms:projectDialog.addProject" })
    ).toBeInTheDocument();
  });

  it("opens wizard sheet when trigger is clicked", async () => {
    const user = userEvent.setup();

    render(
      <EnhancedProjectDialog defaultLeadId="lead-1" entrySource="dashboard">
        <button>Open dialog</button>
      </EnhancedProjectDialog>
    );

    expect(screen.queryByTestId("project-creation-sheet")).not.toBeInTheDocument();
    await user.click(screen.getByText("Open dialog"));
    expect(screen.getByTestId("project-creation-sheet")).toBeInTheDocument();

    expect(latestSheetProps).toMatchObject({
      isOpen: true,
      leadId: "lead-1",
      entrySource: "dashboard",
    });
  });

  it("does not open when trigger is disabled", async () => {
    const user = userEvent.setup();

    render(
      <EnhancedProjectDialog triggerDisabled>
        <button>Disabled trigger</button>
      </EnhancedProjectDialog>
    );

    await user.click(screen.getByText("Disabled trigger"));
    expect(screen.queryByTestId("project-creation-sheet")).not.toBeInTheDocument();
    expect(latestSheetProps?.isOpen).toBeFalsy();
  });
});
