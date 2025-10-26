import { render, screen, fireEvent } from "@testing-library/react";
import { SessionPlanningSummarySidebar } from "../SessionPlanningSummarySidebar";
import { SessionPlanningProvider } from "../../context/SessionPlanningProvider";
import { SessionPlanningEntryContext } from "../../types";
import "@/i18n";

const renderWithProvider = (entryContext: SessionPlanningEntryContext = {}) => {
  const onEditStep = jest.fn();

  render(
    <SessionPlanningProvider entryContext={entryContext}>
      <SessionPlanningSummarySidebar onEditStep={onEditStep} />
    </SessionPlanningProvider>
  );

  return { onEditStep };
};

describe("SessionPlanningSummarySidebar", () => {
  it("shows lead and project information from state", () => {
    renderWithProvider({ leadName: "Acme Bride", leadId: "lead-1", projectName: "Summer Wedding" });

    expect(screen.getByText("Acme Bride")).toBeInTheDocument();
    expect(screen.getByText("Summer Wedding")).toBeInTheDocument();
  });

  it("invokes edit callback when user requests changes", () => {
    const { onEditStep } = renderWithProvider({ leadName: "John Doe", leadId: "lead-42" });

    const editButtons = screen.getAllByRole("button", { name: /edit/i });
    fireEvent.click(editButtons[0]);

    expect(onEditStep).toHaveBeenCalledWith("lead");
  });
});
