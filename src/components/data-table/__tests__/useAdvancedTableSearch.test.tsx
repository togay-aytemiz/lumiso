import { act, fireEvent, render, screen } from "@/utils/testUtils";
import { useAdvancedTableSearch } from "../useAdvancedTableSearch";

const Harness = ({
  searchValue,
  defaultSearchValue,
  delay = 200,
  minChars = 0,
  onSearchChange,
}: {
  searchValue?: string;
  defaultSearchValue?: string;
  delay?: number;
  minChars?: number;
  onSearchChange?: (value: string) => void;
}) => {
  const {
    searchInputValue,
    handleSearchInputChange,
    clearSearch,
    canClearSearch,
  } = useAdvancedTableSearch({
    searchValue,
    defaultSearchValue,
    onSearchChange,
    searchDelay: delay,
    searchMinChars: minChars,
  });

  return (
    <div>
      <input
        aria-label="search"
        value={searchInputValue}
        onChange={(event) => handleSearchInputChange(event.target.value)}
      />
      <button onClick={clearSearch}>clear</button>
      <span data-testid="can-clear">{String(canClearSearch)}</span>
    </div>
  );
};

describe("useAdvancedTableSearch", () => {
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ["performance"] });
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it("debounces search updates and trims emitted value", () => {
    const onSearchChange = jest.fn();
    render(<Harness onSearchChange={onSearchChange} delay={300} minChars={2} />);

    const input = screen.getByLabelText("search");
    act(() => {
      fireEvent.change(input, { target: { value: " R " } });
    });

    act(() => {
      jest.advanceTimersByTime(150);
    });
    expect(onSearchChange).not.toHaveBeenCalled();

    act(() => {
      fireEvent.change(input, { target: { value: " Ready " } });
    });

    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(onSearchChange).toHaveBeenCalledWith("Ready");
    expect(screen.getByTestId("can-clear").textContent).toBe("true");
  });

  it("allows controlled search value updates", () => {
    const { rerender } = render(
      <Harness searchValue="initial" onSearchChange={jest.fn()} />
    );

    expect(screen.getByLabelText("search")).toHaveValue("initial");

    rerender(<Harness searchValue="updated" onSearchChange={jest.fn()} />);
    expect(screen.getByLabelText("search")).toHaveValue("updated");
  });

  it("clears search immediately and emits empty string once", () => {
    const onSearchChange = jest.fn();
    render(
      <Harness
        defaultSearchValue="hello"
        onSearchChange={onSearchChange}
        delay={0}
      />
    );

    expect(screen.getByLabelText("search")).toHaveValue("hello");

    act(() => {
      fireEvent.click(screen.getByText("clear"));
    });

    expect(onSearchChange).toHaveBeenCalledWith("");
    expect(onSearchChange).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("search")).toHaveValue("");
    expect(screen.getByTestId("can-clear").textContent).toBe("false");
  });
});
