import { fireEvent, render, screen, within } from "@testing-library/react";
import { buildSessionSummaryItems } from "./buildSessionSummaryItems";

const labels = {
  dateTime: "Date & time",
  project: "Project",
  notes: "Notes",
  location: "Location",
} as const;

const placeholders = {
  project: "No project linked",
  notes: "No notes captured",
  location: "No location set",
} as const;

const actions = {
  editSchedule: "Edit schedule",
  connectProject: "Connect project",
  addNotes: "Add note",
  addLocation: "Add location",
} as const;

const baseSession = {
  session_date: "2024-05-01",
  session_time: "09:30",
  notes: null,
  location: null,
  projects: null,
} as const;

const findItem = (items: ReturnType<typeof buildSessionSummaryItems>, key: string) => {
  const item = items.find((candidate) => candidate.key === key);
  if (!item) {
    throw new Error(`Unable to find summary item with key ${key}`);
  }
  return item;
};

describe("buildSessionSummaryItems", () => {
  it("surfaces edit shortcuts when optional session context is missing", () => {
    const onEditSchedule = jest.fn();
    const onConnectProject = jest.fn();
    const onAddNotes = jest.fn();
    const onAddLocation = jest.fn();

    const items = buildSessionSummaryItems({
      session: { ...baseSession },
      labels,
      placeholders,
      actions,
      onEditSchedule,
      onConnectProject,
      onAddNotes,
      onAddLocation,
    });

    expect(items).toHaveLength(4);

    const { getByTestId } = render(
      <>
        {items.map((item) => (
          <div key={item.key} data-testid={`${item.key}-action`}>
            {item.action}
          </div>
        ))}
      </>
    );

    fireEvent.click(
      within(getByTestId("date-time-action")).getByRole("button", { name: actions.editSchedule })
    );
    expect(onEditSchedule).toHaveBeenCalledTimes(1);

    const projectAction = within(getByTestId("project-action")).getByRole("button", {
      name: actions.connectProject,
    });
    fireEvent.click(projectAction);
    expect(onConnectProject).toHaveBeenCalledTimes(1);

    const notesAction = within(getByTestId("notes-action")).getByRole("button", {
      name: actions.addNotes,
    });
    fireEvent.click(notesAction);
    expect(onAddNotes).toHaveBeenCalledTimes(1);

    const locationAction = within(getByTestId("location-action")).getByRole("button", {
      name: actions.addLocation,
    });
    fireEvent.click(locationAction);
    expect(onAddLocation).toHaveBeenCalledTimes(1);

    const projectItem = findItem(items, "project");
    const notesItem = findItem(items, "notes");
    const locationItem = findItem(items, "location");

    render(
      <>
        <div data-testid="project-primary">{projectItem.primary}</div>
        <div data-testid="notes-primary">{notesItem.primary}</div>
        <div data-testid="location-primary">{locationItem.primary}</div>
      </>
    );

    expect(screen.getByText(placeholders.project)).toBeInTheDocument();
    expect(screen.getByText(placeholders.notes)).toBeInTheDocument();
    expect(screen.getByText(placeholders.location)).toBeInTheDocument();
  });

  it("hides connect/add shortcuts once the session already has details", () => {
    const items = buildSessionSummaryItems({
      session: {
        ...baseSession,
        notes: "Prep agenda",
        location: "Studio 4A",
        projects: {
          id: "project-123",
          name: "Launch Campaign",
          project_types: { name: "Branding" },
        },
      },
      labels,
      placeholders,
      actions,
      onConnectProject: jest.fn(),
      onAddNotes: jest.fn(),
      onAddLocation: jest.fn(),
    });

    expect(items).toHaveLength(4);

    const projectItem = findItem(items, "project");
    const notesItem = findItem(items, "notes");
    const locationItem = findItem(items, "location");

    expect(projectItem.action).toBeUndefined();
    expect(notesItem.action).toBeUndefined();
    expect(locationItem.action).toBeUndefined();
  });
});
