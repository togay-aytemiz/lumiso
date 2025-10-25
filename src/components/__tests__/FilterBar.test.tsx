import userEvent from "@testing-library/user-event";
import { render, screen, within } from "@/utils/testUtils";
import { FilterBar } from "@/components/FilterBar";
import { useFormsTranslation } from "@/hooks/useTypedTranslation";

jest.mock("@/components/ui/select", () => {
  const React = require("react");
  const SelectContext = React.createContext<{ onValueChange: (value: string) => void }>({
    onValueChange: () => {},
  });

  return {
    __esModule: true,
    Select: ({ onValueChange, children }: any) => (
      <SelectContext.Provider value={{ onValueChange }}>{children}</SelectContext.Provider>
    ),
    SelectTrigger: ({ children }: any) => <button type="button">{children}</button>,
    SelectContent: ({ children }: any) => <div>{children}</div>,
    SelectValue: ({ children }: any) => <span>{children}</span>,
    SelectItem: ({ value, children }: any) => {
      const ctx = React.useContext(SelectContext);
      return (
        <button type="button" onClick={() => ctx.onValueChange(value)}>
          {children}
        </button>
      );
    },
  };
});

jest.mock("@/components/ui/sheet", () => {
  const React = require("react");
  const SheetContext = React.createContext<{ open: boolean; setOpen: (open: boolean) => void }>({
    open: false,
    setOpen: () => {},
  });

  return {
    __esModule: true,
    Sheet: ({ open = false, onOpenChange, children }: any) => (
      <SheetContext.Provider value={{ open, setOpen: (value: boolean) => onOpenChange?.(value) }}>
        {children}
      </SheetContext.Provider>
    ),
    SheetTrigger: ({ children }: any) => {
      const ctx = React.useContext(SheetContext);
      return React.cloneElement(children, {
        onClick: (...args: any[]) => {
          children.props?.onClick?.(...args);
          ctx.setOpen(!ctx.open);
        },
      });
    },
    SheetContent: ({ children }: any) => {
      const ctx = React.useContext(SheetContext);
      return ctx.open ? <div>{children}</div> : null;
    },
    SheetHeader: ({ children }: any) => <div>{children}</div>,
    SheetTitle: ({ children }: any) => <h2>{children}</h2>,
    SheetFooter: ({ children }: any) => <div>{children}</div>,
  };
});

jest.mock("@/hooks/useTypedTranslation", () => ({
  useFormsTranslation: jest.fn(),
}));

const formsTranslations: Record<string, string> = {
  "filterBar.filters": "Filters",
  "filterBar.clear_all": "Clear all",
  "filterBar.apply": "Apply",
  "filterBar.status": "Status",
  "filterBar.date_range": "Date range",
  "filterBar.options": "Options",
  "filterBar.showCompleted": "Show completed",
  "filterBar.hideOverdue": "Hide overdue",
};

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) =>
      formsTranslations[key] ?? options?.defaultValue ?? key,
  }),
}));

const mockUseFormsTranslation = useFormsTranslation as jest.Mock;

describe("FilterBar", () => {
  beforeAll(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: jest.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });
  });

  beforeEach(() => {
    mockUseFormsTranslation.mockReturnValue({
      t: (key: string, options?: { defaultValue?: string }) =>
        formsTranslations[key] ?? options?.defaultValue ?? key,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const baseQuickFilters = [
    { key: "all", label: "All" },
    { key: "today", label: "Today", count: 2 },
    { key: "week", label: "This Week", count: 3 },
  ];

  it("renders quick filters and triggers change handler", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 'never' });
    const onQuickFilterChange = jest.fn();

    render(
      <FilterBar
        quickFilters={baseQuickFilters}
        activeQuickFilter="all"
        onQuickFilterChange={onQuickFilterChange}
      />
    );

    await user.click(screen.getByRole("button", { name: /Today/ }));

    expect(onQuickFilterChange).toHaveBeenCalledWith("today");
  });

  it("shows active filter count when additional filters are applied", () => {
    const onQuickFilterChange = jest.fn();

    render(
      <FilterBar
        quickFilters={baseQuickFilters}
        activeQuickFilter="all"
        onQuickFilterChange={onQuickFilterChange}
        activeStatus="active"
        activeDateFilter="custom"
        showCompleted
        hideOverdue
      />
    );

    const filtersButton = screen.getByRole("button", { name: /Filters/ });
    expect(within(filtersButton).getByText("4")).toBeInTheDocument();
  });

  it("clears filters from the sheet footer", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 'never' });
    const onQuickFilterChange = jest.fn();
    const onDateFilterChange = jest.fn();
    const onStatusChange = jest.fn();
    const onShowCompletedChange = jest.fn();
    const onHideOverdueChange = jest.fn();

    render(
      <FilterBar
        quickFilters={baseQuickFilters}
        activeQuickFilter="today"
        onQuickFilterChange={onQuickFilterChange}
        allDateFilters={[
          { key: "all", label: "All dates" },
          { key: "custom", label: "Custom" },
        ]}
        activeDateFilter="custom"
        onDateFilterChange={onDateFilterChange}
        statusOptions={[
          { key: "all", label: "All statuses" },
          { key: "active", label: "Active" },
        ]}
        activeStatus="active"
        onStatusChange={onStatusChange}
        showCompleted
        onShowCompletedChange={onShowCompletedChange}
        hideOverdue
        onHideOverdueChange={onHideOverdueChange}
      />
    );

    await user.click(screen.getByRole("button", { name: /Filters/ }));
    await user.click(await screen.findByRole("button", { name: /Clear all/ }));

    expect(onQuickFilterChange).toHaveBeenCalledWith("all");
    expect(onDateFilterChange).toHaveBeenCalledWith("all");
    expect(onStatusChange).toHaveBeenCalledWith("all");
    expect(onShowCompletedChange).toHaveBeenCalledWith(false);
    expect(onHideOverdueChange).not.toHaveBeenCalled();
  });

  it("invokes status, date, and toggle handlers from the sheet content", async () => {
    const user = userEvent.setup();
    const onDateFilterChange = jest.fn();
    const onStatusChange = jest.fn();
    const onShowCompletedChange = jest.fn();
    const onHideOverdueChange = jest.fn();

    render(
      <FilterBar
        quickFilters={baseQuickFilters}
        activeQuickFilter="all"
        onQuickFilterChange={jest.fn()}
        allDateFilters={[
          { key: "all", label: "All dates" },
          { key: "upcoming", label: "Upcoming" },
        ]}
        activeDateFilter="all"
        onDateFilterChange={onDateFilterChange}
        statusOptions={[
          { key: "all", label: "All statuses" },
          { key: "completed", label: "Completed" },
        ]}
        activeStatus="all"
        onStatusChange={onStatusChange}
        onShowCompletedChange={onShowCompletedChange}
        onHideOverdueChange={onHideOverdueChange}
        showCompleted={false}
        hideOverdue={false}
        showCompletedLabel="Show completed"
        hideOverdueLabel="Hide overdue"
      />
    );

    await user.click(screen.getByRole("button", { name: /Filters/ }));

    // Change date filter
    await user.click(screen.getByRole("button", { name: /Upcoming/ }));
    expect(onDateFilterChange).toHaveBeenCalledWith("upcoming");

    // Choose a status option directly from the list
    await user.click(await screen.findByRole("button", { name: "Completed" }));
    expect(onStatusChange).toHaveBeenCalledWith("completed");

    await user.click(screen.getByLabelText("Show completed"));
    expect(onShowCompletedChange).toHaveBeenCalledWith(true);

    await user.click(screen.getByLabelText("Hide overdue"));
    expect(onHideOverdueChange).toHaveBeenCalledWith(true);
  });
});
