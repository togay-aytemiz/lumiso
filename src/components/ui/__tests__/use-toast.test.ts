import { act, renderHook } from "@testing-library/react";
import { toast, useToast } from "@/hooks/use-toast";

const clearToasts = () => {
  const { result, unmount } = renderHook(() => useToast());
  act(() => {
    result.current.dismiss();
    jest.runOnlyPendingTimers();
  });
  unmount();
};

beforeEach(() => {
  jest.useFakeTimers({ doNotFake: ["performance"] });
  clearToasts();
});

afterEach(() => {
  clearToasts();
  jest.useRealTimers();
});

describe("toast hook", () => {
  it("adds toasts and enforces the queue limit", () => {
    const { result, unmount } = renderHook(() => useToast());

    act(() => {
      toast({ title: "First" });
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].title).toBe("First");

    act(() => {
      toast({ title: "Second" });
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].title).toBe("Second");

    unmount();
  });

  it("dismisses toasts and removes them after the timer elapses", () => {
    const { result, unmount } = renderHook(() => useToast());

    let toastId = "";
    act(() => {
      toastId = toast({ title: "Dismiss me" }).id;
    });

    act(() => {
      result.current.dismiss(toastId);
    });

    expect(result.current.toasts[0].open).toBe(false);

    act(() => {
      jest.runOnlyPendingTimers();
    });

    expect(result.current.toasts).toHaveLength(0);

    unmount();
  });

  it("allows updating toast properties", () => {
    const { result, unmount } = renderHook(() => useToast());

    act(() => {
      const handle = toast({ title: "Initial", description: "Original" });
      handle.update({ description: "Updated" } as any);
    });

    expect(result.current.toasts[0]).toMatchObject({
      title: "Initial",
      description: "Updated",
    });

    unmount();
  });
});
