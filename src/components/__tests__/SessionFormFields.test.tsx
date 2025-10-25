import { render, screen, fireEvent } from "@testing-library/react";
import { SessionFormFields } from "../SessionFormFields";

jest.mock("@/components/ui/select", () => {
  const React = require("react");
  return {
    Select: ({ value, onValueChange, children }: any) => (
      <select
        data-testid="session-select"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
      >
        {children}
      </select>
    ),
    SelectTrigger: ({ children }: any) => <>{children}</>,
    SelectValue: ({ placeholder }: any) => (
      <option value="">{placeholder}</option>
    ),
    SelectContent: ({ children }: any) => <>{children}</>,
    SelectItem: ({ value, children }: any) => (
      <option value={value}>{children}</option>
    ),
  };
});

jest.mock("@/hooks/useTypedTranslation", () => ({
  useFormsTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("SessionFormFields", () => {
  it("renders project information when selector disabled", () => {
    render(
      <SessionFormFields
        leadName="Alice"
        projectName="Wedding"
        sessionName="Morning Session"
        location="Studio"
        notes="Bring props"
        onSessionNameChange={jest.fn()}
        onLocationChange={jest.fn()}
        onNotesChange={jest.fn()}
      />
    );

    expect(screen.getByDisplayValue("Alice")).toBeDisabled();
    expect(screen.getByDisplayValue("Wedding")).toBeDisabled();
    expect(screen.getByDisplayValue("Morning Session")).toBeEnabled();
  });

  it("allows selecting a project when selector shown", async () => {
    const onProjectChange = jest.fn();

    render(
      <SessionFormFields
        leadName="Alice"
        projectName=""
        sessionName=""
        location=""
        notes=""
        projectId=""
        showProjectSelector
        availableProjects={[
          { id: "proj-1", name: "Engagement" },
          { id: "proj-2", name: "Portrait" },
        ]}
        onSessionNameChange={jest.fn()}
        onLocationChange={jest.fn()}
        onNotesChange={jest.fn()}
        onProjectChange={onProjectChange}
      />
    );

    fireEvent.change(screen.getByTestId("session-select"), {
      target: { value: "proj-2" },
    });

    expect(onProjectChange).toHaveBeenCalledWith("proj-2");
  });

  it("invokes change handlers for text inputs", () => {
    const onSessionNameChange = jest.fn();
    const onLocationChange = jest.fn();
    const onNotesChange = jest.fn();

    render(
      <SessionFormFields
        leadName=""
        sessionName=""
        location=""
        notes=""
        onSessionNameChange={onSessionNameChange}
        onLocationChange={onLocationChange}
        onNotesChange={onNotesChange}
      />
    );

    fireEvent.change(screen.getByLabelText("sessionScheduling.session_name *"), {
      target: { value: "New Session" },
    });
    fireEvent.change(screen.getByLabelText("sessionScheduling.location_address"), {
      target: { value: "New Location" },
    });
    fireEvent.change(
      screen.getByLabelText("sessionScheduling.session_notes_optional"),
      { target: { value: "Extra notes" } }
    );

    expect(onSessionNameChange).toHaveBeenCalledWith("New Session");
    expect(onLocationChange).toHaveBeenCalledWith("New Location");
    expect(onNotesChange).toHaveBeenCalledWith("Extra notes");
  });
});
