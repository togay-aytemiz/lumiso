import React from "react";
import { render, screen } from "@/utils/testUtils";
import { PaymentsDateControls } from "../PaymentsDateControls";
import type { DateRange } from "react-day-picker";

type MockSelectProps = {
  value?: string;
  onValueChange?: (value: string) => void;
  children?: React.ReactNode;
};

type SelectModule = typeof import("@/components/ui/select");

type DateRangePickerModule = typeof import("@/components/DateRangePicker");

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock("@/components/ui/select", () => {
  const Select = jest.fn(({ children }: MockSelectProps) => (
    <div data-testid="payments-select">{children}</div>
  ));
  const SelectTrigger = ({ children }: { children: React.ReactNode }) => (
    <div data-testid="select-trigger">{children}</div>
  );
  const SelectValue = ({ placeholder }: { placeholder?: string }) => (
    <span data-testid="select-placeholder">{placeholder}</span>
  );
  const SelectContent = ({ children }: { children: React.ReactNode }) => (
    <div data-testid="select-content">{children}</div>
  );
  const SelectItem = ({ value, children }: { value: string; children: React.ReactNode }) => (
    <div data-testid={`select-item-${value}`}>{children}</div>
  );
  return { Select, SelectTrigger, SelectValue, SelectContent, SelectItem };
});

jest.mock("@/components/DateRangePicker", () => ({
  DateRangePicker: jest.fn(() => <div data-testid="date-range-picker" />),
}));

describe("PaymentsDateControls", () => {
  const selectModule = jest.requireMock("@/components/ui/select") as SelectModule & {
    Select: jest.Mock;
  };
  const dateRangePickerModule = jest.requireMock("@/components/DateRangePicker") as DateRangePickerModule & {
    DateRangePicker: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the range label when provided", () => {
    render(
      <PaymentsDateControls
        rangeLabel="Jan 1 – Jan 31"
        rangeNotice=""
        selectedFilter="last7days"
        onSelectedFilterChange={jest.fn()}
        onCustomDateRangeChange={jest.fn()}
      />
    );

    expect(screen.getByText("payments.range.label")).toBeInTheDocument();
    expect(screen.getByText("Jan 1 – Jan 31")).toBeInTheDocument();
    expect(screen.queryByText("payments.range.noData")).not.toBeInTheDocument();
  });

  it("falls back to range notice when label is empty", () => {
    render(
      <PaymentsDateControls
        rangeLabel=""
        rangeNotice="Select a range"
        selectedFilter="last7days"
        onSelectedFilterChange={jest.fn()}
        onCustomDateRangeChange={jest.fn()}
      />
    );

    expect(screen.getByText("Select a range")).toBeInTheDocument();
  });

  it("invokes the filter change handler", () => {
    const handleChange = jest.fn();

    render(
      <PaymentsDateControls
        rangeLabel=""
        rangeNotice=""
        selectedFilter="last7days"
        onSelectedFilterChange={handleChange}
        onCustomDateRangeChange={jest.fn()}
      />
    );

    const selectProps = selectModule.Select.mock.calls[0][0] as MockSelectProps;
    selectProps.onValueChange?.("custom");

    expect(handleChange).toHaveBeenCalledWith("custom");
  });

  it("shows the date range picker for custom filter", () => {
    const range: DateRange = { from: new Date("2024-05-01") };
    const handleRangeChange = jest.fn();

    render(
      <PaymentsDateControls
        rangeLabel=""
        rangeNotice=""
        selectedFilter="custom"
        customDateRange={range}
        onSelectedFilterChange={jest.fn()}
        onCustomDateRangeChange={handleRangeChange}
      />
    );

    expect(dateRangePickerModule.DateRangePicker).toHaveBeenCalledWith(
      expect.objectContaining({
        dateRange: range,
        onDateRangeChange: handleRangeChange,
      }),
      {}
    );
  });
});
