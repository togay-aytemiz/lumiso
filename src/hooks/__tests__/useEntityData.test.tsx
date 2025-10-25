jest.mock("@/hooks/use-toast", () => ({
  toast: jest.fn(),
}));

import { renderHook, act, waitFor } from "@testing-library/react";

import { useEntityData } from "../useEntityData";
import { toast } from "@/hooks/use-toast";

const toastMock = toast as unknown as jest.Mock;

beforeEach(() => {
  toastMock.mockReset();
});

describe("useEntityData", () => {
  it("fetches data on mount and updates state", async () => {
    const fetchFn = jest.fn().mockResolvedValue([{ id: "1" }, { id: "2" }]);

    const { result } = renderHook(() => useEntityData({ fetchFn }));

    expect(result.current.loading).toBe(true);
    expect(fetchFn).toHaveBeenCalledTimes(1);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toEqual([{ id: "1" }, { id: "2" }]);
    expect(result.current.error).toBeNull();
  });

  it("handles errors by showing a destructive toast when no onError provided", async () => {
    const fetchFn = jest
      .fn()
      .mockRejectedValue(new Error("supabase unavailable"));

    const { result } = renderHook(() => useEntityData({ fetchFn }));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe("supabase unavailable");
    expect(toastMock).toHaveBeenCalledWith({
      title: "Error",
      description: "supabase unavailable",
      variant: "destructive",
    });
  });

  it("defers to custom onError handler and skips toast", async () => {
    const fetchFn = jest.fn().mockRejectedValue(new Error("network hiccup"));
    const onError = jest.fn();

    renderHook(() =>
      useEntityData({
        fetchFn,
        onError,
      })
    );

    await waitFor(() => expect(onError).toHaveBeenCalledWith(expect.any(Error)));

    expect(toastMock).not.toHaveBeenCalled();
  });

  it("re-fetches when dependencies change", async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce([{ id: "first" }])
      .mockResolvedValue([{ id: "second" }]);

    const { result, rerender } = renderHook(
      ({ orgId }) =>
        useEntityData({
          fetchFn,
          dependencies: [orgId],
        }),
      { initialProps: { orgId: "org-1" } }
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual([{ id: "first" }]);

    rerender({ orgId: "org-2" });

    await waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(2));
    expect(result.current.data).toEqual([{ id: "second" }]);
  });

  it("exposes refetch helper that re-invokes fetchFn", async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce([{ id: "initial" }])
      .mockResolvedValue([{ id: "refetched" }]);

    const { result } = renderHook(() => useEntityData({ fetchFn }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual([{ id: "initial" }]);

    await act(async () => {
      await result.current.refetch();
    });

    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(result.current.data).toEqual([{ id: "refetched" }]);
  });
});
