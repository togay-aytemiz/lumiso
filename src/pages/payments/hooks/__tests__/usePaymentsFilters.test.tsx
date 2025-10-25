import { act, renderHook, waitFor } from "@testing-library/react";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

import type { PaymentsFiltersState } from "../usePaymentsFilters";
import { usePaymentsFilters } from "../usePaymentsFilters";
import type { PaymentStatusFilter, PaymentTypeFilter } from "../../types";

describe("usePaymentsFilters", () => {
  const buildState = (overrides: Partial<PaymentsFiltersState> = {}): PaymentsFiltersState => ({
    status: [],
    type: [],
    amountMin: null,
    amountMax: null,
    search: "",
    ...overrides,
  });

  it("initializes with normalized state and counts active filters", () => {
    const initialState = buildState({
      status: ["paid" satisfies PaymentStatusFilter],
      type: ["manual" satisfies PaymentTypeFilter],
      amountMin: 25,
      amountMax: 75,
      search: "existing",
    });

    const { result } = renderHook(() =>
      usePaymentsFilters({
        initialState,
      })
    );

    expect(result.current.state).toEqual(initialState);
    expect(result.current.searchValue).toBe("existing");
    expect(result.current.activeFilterCount).toBe(4);
    expect(result.current.filtersConfig.activeCount).toBe(4);
    expect(result.current.filtersConfig.onReset).toBeDefined();
  });

  it("updates search state only when the threshold is met", () => {
    const onStateChange = jest.fn();
    const { result } = renderHook(() =>
      usePaymentsFilters({
        onStateChange,
      })
    );

    act(() => {
      result.current.onSearchChange("hi");
    });

    expect(onStateChange).not.toHaveBeenCalled();
    expect(result.current.state.search).toBe("");

    act(() => {
      result.current.onSearchChange("   ready   ");
    });

    expect(onStateChange).toHaveBeenCalledTimes(1);
    expect(onStateChange.mock.calls[0][1].reason).toBe("search");
    expect(result.current.state.search).toBe("ready");
    expect(result.current.searchValue).toBe("   ready   ");

    onStateChange.mockClear();

    act(() => {
      result.current.onSearchClear();
    });

    expect(onStateChange).toHaveBeenCalledTimes(1);
    expect(onStateChange.mock.calls[0][1].reason).toBe("search");
    expect(result.current.state.search).toBe("");
    expect(result.current.searchValue).toBe("");
  });

  it("resets filters through the exposed configuration handler", () => {
    const onStateChange = jest.fn();
    const initialState = buildState({
      status: ["due" satisfies PaymentStatusFilter],
      type: ["base_price" satisfies PaymentTypeFilter],
      amountMin: 10,
      amountMax: 50,
    });

    const { result } = renderHook(() =>
      usePaymentsFilters({
        onStateChange,
        initialState,
      })
    );

    act(() => {
      result.current.onSearchChange("delta");
    });

    onStateChange.mockClear();

    act(() => {
      result.current.filtersConfig.onReset?.();
    });

    expect(onStateChange).toHaveBeenCalledTimes(1);
    expect(onStateChange.mock.calls[0][1].reason).toBe("reset");
    expect(result.current.state).toEqual({ ...initialState, search: "" });
    expect(result.current.searchValue).toBe("");
    expect(result.current.activeFilterCount).toBe(4);
  });

  it("synchronizes with incoming initial state changes", async () => {
    const onStateChange = jest.fn();
    const { result, rerender } = renderHook(
      ({ initialState }: { initialState: PaymentsFiltersState }) =>
        usePaymentsFilters({
          onStateChange,
          initialState,
        }),
      {
        initialProps: {
          initialState: buildState({
            status: ["paid" satisfies PaymentStatusFilter],
            search: "alpha",
          }),
        },
      }
    );

    expect(result.current.state.search).toBe("alpha");
    expect(result.current.searchValue).toBe("alpha");

    const nextState = buildState({
      status: ["paid", "due"].map((value) => value as PaymentStatusFilter),
      type: ["extra" satisfies PaymentTypeFilter],
      amountMax: 90,
      search: "due",
    });

    rerender({ initialState: nextState });

    await waitFor(() => expect(result.current.state.search).toBe("due"));

    expect(result.current.state).toEqual(nextState);
    expect(result.current.searchValue).toBe("due");
    expect(result.current.activeFilterCount).toBe(2);
  });
});
