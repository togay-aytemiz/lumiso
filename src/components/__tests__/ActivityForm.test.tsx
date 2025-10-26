import { render, screen, fireEvent } from "@/utils/testUtils";
import userEvent from "@testing-library/user-event";
import { ActivityForm } from "../shared/ActivityForm";
import { useFormsTranslation } from "@/hooks/useTypedTranslation";
import React from "react";

jest.mock("@/hooks/useTypedTranslation", () => ({
  useFormsTranslation: jest.fn(),
}));

const DateTimePickerMock = ({ value, onChange, placeholder }: any) => (
  <div>
    <label htmlFor="mock-date">{placeholder}</label>
    <input
      id="mock-date"
      data-testid="date-input"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  </div>
);

jest.mock("@/components/ui/date-time-picker", () => ({
  __esModule: true,
  default: (props: any) => <DateTimePickerMock {...props} />,
}));

jest.mock("@/components/ui/switch", () => ({
  Switch: ({
    checked,
    onCheckedChange,
    ...rest
  }: {
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
  }) => (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      {...rest}
    >
      toggle
    </button>
  ),
}));

describe("ActivityForm", () => {
  const useFormsTranslationMock =
    useFormsTranslation as jest.MockedFunction<typeof useFormsTranslation>;

  beforeEach(() => {
    useFormsTranslationMock.mockReturnValue({
      t: (key: string, { ns }: { ns?: string } = {}) => {
        const translations: Record<string, string> = {
          "activities.note_label": "Note",
          "activities.set_reminder_label": "Set reminder",
          "activities.enter_note_placeholder": "Write a note",
          "activities.date_time_label": "Date & time",
          "activities.add_note": "Add note",
          "activities.add_reminder": "Add reminder",
          "activities.saving": "Saving…",
          "dateTimePicker.placeholder": "Pick date & time",
          "dateTimePicker.time": "Time",
          "dateTimePicker.today": "Today",
          "dateTimePicker.clear": "Clear",
          "dateTimePicker.done": "Done",
        };
        const keyWithNamespace = ns ? `${ns}:${key}` : key;
        return translations[keyWithNamespace] ?? translations[key] ?? key;
      },
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("submits notes and resets the form state", async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn().mockResolvedValue(undefined);

    render(<ActivityForm loading={false} onSubmit={onSubmit} />);

    const textarea = screen.getByPlaceholderText("Write a note");
    const submitButton = screen.getByRole("button", { name: "Add note" });
    expect(submitButton).toBeDisabled();

    await user.type(textarea, "Meeting summary");
    expect(submitButton).not.toBeDisabled();

    await user.click(submitButton);

    expect(onSubmit).toHaveBeenCalledWith("Meeting summary", false, "");
    expect(textarea).toHaveValue("");
    expect(submitButton).toBeDisabled();
  });

  it("requires a reminder date before submission when reminder mode is active", async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn().mockResolvedValue(undefined);

    render(<ActivityForm loading={false} onSubmit={onSubmit} />);

    const textarea = screen.getByPlaceholderText("Write a note");
    await user.type(textarea, "Reminder to follow up");

    await user.click(screen.getByRole("switch"));

    expect(screen.getByText("Date & time")).toBeInTheDocument();

    const submitButton = screen.getByRole("button", { name: "Add reminder" });
    expect(submitButton).toBeDisabled();

    const dateInput = screen.getByTestId("date-input");
    fireEvent.change(dateInput, {
      target: { value: "2025-01-05T09:00" },
    });

    expect(submitButton).not.toBeDisabled();

    await user.click(submitButton);

    expect(onSubmit).toHaveBeenCalledWith(
      "Reminder to follow up",
      true,
      "2025-01-05T09:00"
    );
    expect(screen.queryByTestId("date-input")).not.toBeInTheDocument();
  });
});
