import { act, fireEvent, render, screen } from "@/utils/testUtils";
import { useDraftFilters } from "../useDraftFilters";

interface FilterState {
  status: string;
  term: string;
}

const Harness = ({
  initialState,
  onApply,
  onReset,
}: {
  initialState: FilterState;
  onApply?: (next: FilterState) => void;
  onReset?: (next: FilterState) => void;
}) => {
  const { state, draft, updateDraft, apply, reset, dirty } = useDraftFilters({
    initialState,
    onApply,
    onReset,
    isEqual: (a, b) => a.status === b.status && a.term === b.term,
  });

  return (
    <div>
      <span data-testid="state">{JSON.stringify(state)}</span>
      <span data-testid="draft">{JSON.stringify(draft)}</span>
      <span data-testid="dirty">{String(dirty)}</span>
      <button onClick={() => updateDraft({ status: "closed" })}>close</button>
      <button onClick={() => updateDraft((prev) => ({ ...prev, term: "vip" }))}>
        vip
      </button>
      <button onClick={() => apply()}>apply</button>
      <button onClick={() => reset()}>reset</button>
    </div>
  );
};

describe("useDraftFilters", () => {
  const initialState: FilterState = { status: "open", term: "" };

  it("tracks draft changes and applies them", () => {
    const onApply = jest.fn();
    render(
      <Harness initialState={initialState} onApply={onApply} />
    );

    expect(screen.getByTestId("dirty").textContent).toBe("false");
    act(() => {
      fireEvent.click(screen.getByText("close"));
    });

    expect(screen.getByTestId("dirty").textContent).toBe("true");
    expect(screen.getByTestId("draft").textContent).toContain('"status":"closed"');

    act(() => {
      fireEvent.click(screen.getByText("apply"));
    });

    expect(onApply).toHaveBeenCalledWith({ status: "closed", term: "" });
    expect(screen.getByTestId("state").textContent).toContain('"status":"closed"');
    expect(screen.getByTestId("dirty").textContent).toBe("false");
  });

  it("resets state and triggers onReset", () => {
    const onReset = jest.fn();
    render(
      <Harness initialState={initialState} onReset={onReset} />
    );

    act(() => {
      fireEvent.click(screen.getByText("close"));
      fireEvent.click(screen.getByText("vip"));
    });

    expect(screen.getByTestId("dirty").textContent).toBe("true");

    act(() => {
      fireEvent.click(screen.getByText("reset"));
    });

    expect(onReset).toHaveBeenCalledWith(initialState);
    expect(screen.getByTestId("state").textContent).toContain('"status":"open"');
    expect(screen.getByTestId("draft").textContent).toContain('"term":""');
    expect(screen.getByTestId("dirty").textContent).toBe("false");
  });
});
