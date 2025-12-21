jest.mock("@/hooks/use-toast", () => ({
  useToast: jest.fn(),
}));

import { act, renderHook } from "@testing-library/react";

import { useSettingsSection } from "../useSettingsSection";
import { useToast } from "@/hooks/use-toast";

const toastMock = jest.fn();

describe("useSettingsSection", () => {
beforeEach(() => {
  jest.clearAllMocks();
  (useToast as jest.Mock).mockReturnValue({ toast: toastMock });
});

  const initialValues = { enabled: false, days: 7 };

  it("tracks dirty state and allows cancelling/resetting", () => {
    const { result } = renderHook(() =>
      useSettingsSection({
        sectionName: "Notifications",
        initialValues,
        onSave: jest.fn(),
      })
    );

    expect(result.current.isDirty).toBe(false);

    act(() => {
      result.current.updateValue("enabled", true);
    });
    expect(result.current.values.enabled).toBe(true);
    expect(result.current.isDirty).toBe(true);

    act(() => {
      result.current.handleCancel();
    });
    expect(result.current.values).toEqual(initialValues);
    expect(result.current.isDirty).toBe(false);

    act(() => {
      result.current.updateValue("days", 14);
    });
    expect(result.current.isDirty).toBe(true);

    act(() => {
      result.current.handleReset();
    });
    expect(result.current.values).toEqual(initialValues);
    expect(result.current.isDirty).toBe(false);
  });

  it("performs manual save and handles error toasts", async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useSettingsSection({
        sectionName: "Notifications",
        initialValues,
        onSave,
      })
    );

    await act(async () => {
      await result.current.handleSave({ enabled: true, days: 3 });
    });

    expect(onSave).toHaveBeenCalledWith({ enabled: true, days: 3 });
    expect(toastMock).toHaveBeenCalledWith({
      title: "Settings saved",
      description: "Saved Notifications settings",
      duration: 3000,
    });
    expect(result.current.isDirty).toBe(false);

    toastMock.mockClear();
    onSave.mockRejectedValueOnce(new Error("save failed"));

    await act(async () => {
      await result.current.handleSave({ enabled: false, days: 5 });
    });

    expect(toastMock).toHaveBeenCalledWith({
      title: "Error",
      description: "save failed",
      variant: "destructive",
      duration: 5000,
    });
  });

  it("auto-saves with throttling and success indicator", async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useSettingsSection({
        sectionName: "AutoSave",
        initialValues: { enabled: false },
        onSave,
        autoSave: true,
        throttleMs: 5,
      })
    );

    act(() => {
      result.current.updateValue("enabled", true);
    });

    expect(onSave).not.toHaveBeenCalled();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    expect(onSave).toHaveBeenCalledWith({ enabled: true });
    expect(toastMock).toHaveBeenCalledWith({
      title: "Changes updated",
      description: "AutoSave updated",
      duration: 2000,
    });
    expect(result.current.showSuccess).toBe(true);

    expect(result.current.showSuccess).toBe(true);
  });

  it("respects disableToast flag for success messages", async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useSettingsSection({
        sectionName: "NoToast",
        initialValues,
        onSave,
        disableToast: true,
      })
    );

    await act(async () => {
      await result.current.handleSave({ enabled: true, days: 2 });
    });

    expect(toastMock).not.toHaveBeenCalled();
  });
});
