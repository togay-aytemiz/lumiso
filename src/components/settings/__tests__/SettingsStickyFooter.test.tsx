import { render, screen, fireEvent } from "@/utils/testUtils";
import { SettingsStickyFooter } from "../SettingsStickyFooter";

describe("SettingsStickyFooter", () => {
  const baseProps = {
    show: true,
    isSaving: false,
    showSuccess: false,
    onSave: jest.fn(),
    onCancel: jest.fn(),
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("does not render when show is false", () => {
    render(<SettingsStickyFooter {...baseProps} show={false} />);
    expect(screen.queryByRole("button", { name: /Cancel/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Save/ })).toBeNull();
  });

  it("renders buttons and triggers callbacks", () => {
    render(<SettingsStickyFooter {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    expect(baseProps.onCancel).toHaveBeenCalledTimes(1);
    expect(baseProps.onSave).toHaveBeenCalledTimes(1);
  });

  it("shows saving indicator and disables buttons while saving", () => {
    render(<SettingsStickyFooter {...baseProps} isSaving />);

    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Saving/ })).toBeDisabled();
    expect(screen.getByText("Saving...")).toBeInTheDocument();
  });

  it("shows success state when showSuccess is true", () => {
    render(<SettingsStickyFooter {...baseProps} showSuccess />);

    expect(screen.getByRole("button", { name: "Settings saved" })).toBeEnabled();
  });
});
