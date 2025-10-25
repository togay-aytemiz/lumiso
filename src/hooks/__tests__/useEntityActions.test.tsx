import { act, renderHook } from "@testing-library/react";
import { useEntityActions } from "../useEntityActions";

const toastMock = jest.fn();

jest.mock("@/hooks/use-toast", () => ({
  toast: (...args: unknown[]) => toastMock(...args),
}));

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

const createDeferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe("useEntityActions", () => {
  beforeEach(() => {
    toastMock.mockReset();
  });

  it("tracks loading and triggers success callbacks", async () => {
    const { result } = renderHook(() => useEntityActions());
    const onSuccess = jest.fn();

    const deferred = createDeferred<string>();
    let execution: Promise<string>;

    await act(async () => {
      execution = result.current.executeAction("save", () => deferred.promise, {
        successMessage: "Saved",
        onSuccess,
      });
      await flushPromises();
    });

    expect(result.current.getActionState("save")).toEqual({ loading: true, error: null });

    await act(async () => {
      deferred.resolve("ok");
      await execution;
      await flushPromises();
    });

    expect(onSuccess).toHaveBeenCalledWith("ok");
    expect(result.current.getActionState("save")).toEqual({ loading: false, error: null });
    expect(toastMock).toHaveBeenCalledWith({ title: "Success", description: "Saved" });
  });

  it("handles errors with toast fallback", async () => {
    const { result } = renderHook(() => useEntityActions());

    await act(async () => {
      await result.current.executeAction(
        "delete",
        () => Promise.reject(new Error("boom")),
        { errorMessage: "Failed" }
      );
      await flushPromises();
    });

    expect(result.current.getActionState("delete")).toEqual({ loading: false, error: "boom" });
    expect(toastMock).toHaveBeenCalledWith({
      title: "Error",
      description: "Failed",
      variant: "destructive",
    });
  });

  it("supports custom onError and clears state", async () => {
    const { result } = renderHook(() => useEntityActions());
    const onError = jest.fn();

    await act(async () => {
      await result.current.executeAction(
        "update",
        () => Promise.reject(new Error("fail")),
        { onError }
      );
      await flushPromises();
    });

    expect(onError).toHaveBeenCalledWith(expect.any(Error));
    expect(toastMock).not.toHaveBeenCalled();

    act(() => {
      result.current.clearActionState("update");
    });

    expect(result.current.getActionState("update")).toEqual({ loading: false, error: null });
  });

  it("isolates concurrent actions", async () => {
    const { result } = renderHook(() => useEntityActions());

    const deferredA = createDeferred<string>();
    const deferredB = createDeferred<string>();
    let promiseA: Promise<string>;
    let promiseB: Promise<string>;

    await act(async () => {
      promiseA = result.current.executeAction("a", () => deferredA.promise) as Promise<string>;
      promiseB = result.current.executeAction("b", () => deferredB.promise) as Promise<string>;
      await flushPromises();
    });

    expect(result.current.getActionState("a")).toEqual({ loading: true, error: null });
    expect(result.current.getActionState("b")).toEqual({ loading: true, error: null });

    await act(async () => {
      deferredA.resolve("done");
      deferredB.resolve("done");
      await Promise.all([promiseA, promiseB]);
      await flushPromises();
    });

    expect(result.current.getActionState("a")).toEqual({ loading: false, error: null });
    expect(result.current.getActionState("b")).toEqual({ loading: false, error: null });
  });
});
