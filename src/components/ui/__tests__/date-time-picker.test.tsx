import { fireEvent, render, screen } from "@/utils/testUtils";
import { format } from "date-fns";
import { getDateFnsLocale } from "@/lib/utils";
import { DateTimePicker } from "../date-time-picker";

jest.mock("react-calendar/dist/Calendar.css", () => ({}), { virtual: true });
jest.mock("@/components/react-calendar.css", () => ({}), { virtual: true });

jest.mock("@/components/ui/popover", () => {
  const React = require("react");
  return {
    Popover: ({ children }: any) => <div data-testid="popover">{children}</div>,
    PopoverTrigger: ({ children }: any) => <div>{children}</div>,
    PopoverContent: ({ children }: any) => <div>{children}</div>,
  };
});

jest.mock("@/components/ui/select", () => {
  const React = require("react");

  const SelectValue = ({ placeholder }: any) => (
    <option value="">{placeholder}</option>
  );

  const SelectItem = ({ value, children }: any) => (
    <option value={value}>{children}</option>
  );

  const collectOptions = (nodes: any): any[] => {
    const options: any[] = [];
    React.Children.forEach(nodes, (child: any) => {
      if (!React.isValidElement(child)) return;
      if (child.type === SelectValue || child.type === SelectItem) {
        options.push(child);
        return;
      }
      if (child.props?.children) {
        options.push(...collectOptions(child.props.children));
      }
    });
    return options;
  };

  const Select = ({ children, value, onValueChange, className, ...rest }: any) => {
    const options = collectOptions(children);
    return (
      <select
        className={className}
        data-testid={rest["data-testid"]}
        value={value}
        onChange={event => onValueChange?.(event.target.value)}
      >
        {options}
      </select>
    );
  };

  const SelectTrigger = ({ children }: any) => <>{children}</>;
  const SelectContent = ({ children }: any) => <>{children}</>;

  return { Select, SelectTrigger, SelectValue, SelectContent, SelectItem };
});

jest.mock("react-calendar", () => ({
  __esModule: true,
  default: ({ onChange }: any) => (
    <div>
      <button type="button" onClick={() => onChange(new Date(2024, 0, 15))}>
        choose-date
      </button>
    </div>
  ),
}));

describe("DateTimePicker", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows placeholder text when no value is provided", () => {
    render(<DateTimePicker onChange={jest.fn()} />);

    expect(
      screen.getByRole("button", { name: /Pick date & time/i })
    ).toBeInTheDocument();
  });

  it("renders the formatted value when an initial date is provided", () => {
    const value = "2024-01-05T10:30";
    render(<DateTimePicker value={value} onChange={jest.fn()} />);

    const button = screen.getByRole("button", { name: /2024/ });
    const expected = format(new Date("2024-01-05T10:30"), "PP p", {
      locale: getDateFnsLocale(),
    });
    expect(button).toHaveTextContent(expected);
  });

  it("emits ISO local strings when selecting a date and adjusting the time", () => {
    const onChange = jest.fn();
    render(<DateTimePicker onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "choose-date" }));
    expect(onChange).toHaveBeenLastCalledWith("2024-01-15T09:00");

    const [hoursSelect, minutesSelect] = screen.getAllByRole("combobox");

    fireEvent.change(hoursSelect, { target: { value: "15" } });
    expect(onChange).toHaveBeenLastCalledWith("2024-01-15T15:00");

    fireEvent.change(minutesSelect, { target: { value: "30" } });
    expect(onChange).toHaveBeenLastCalledWith("2024-01-15T15:30");
  });

  it("clears the current selection via the clear button", () => {
    const onChange = jest.fn();
    render(<DateTimePicker onChange={onChange} value="2024-02-10T12:00" />);

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(onChange).toHaveBeenLastCalledWith("");
    expect(screen.getByRole("button", { name: /Pick date & time/ })).toBeInTheDocument();
  });
});
