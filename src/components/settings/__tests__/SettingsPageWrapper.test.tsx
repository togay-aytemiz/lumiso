import { act, render, screen } from "@/utils/testUtils";
import SettingsPageWrapper from "../SettingsPageWrapper";
import type { SettingsStickyFooterProps } from "../SettingsStickyFooter";
import { fireEvent } from "@testing-library/react";

const toastMock = jest.fn();
const hasCategoryChangesMock = jest.fn();
const saveCategoryChangesMock = jest.fn();
const cancelCategoryChangesMock = jest.fn();

const stickyFooterProps: SettingsStickyFooterProps[] = [];

jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useLocation: () => ({ pathname: "/settings/general" }),
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        "toast.settingsSavedTitle": "Settings saved",
        "toast.settingsSavedDescription": "Your changes have been saved successfully.",
        "toast.error": "Error",
        "toast.settingsSaveErrorDescription": "Failed to save settings. Please try again.",
        "toast.settingsDiscardedTitle": "Changes discarded",
        "toast.settingsDiscardedDescription": "Your unsaved changes have been discarded.",
      };

      if (key === "toast.settingsSavedCategory") {
        const category = options?.category as string | undefined;
        return category ? `Saved ${category} settings` : "Saved settings";
      }

      return translations[key] ?? key;
    },
  }),
}));

jest.mock("@/contexts/SettingsContext", () => ({
  useSettingsContext: () => ({
    hasCategoryChanges: hasCategoryChangesMock,
    saveCategoryChanges: saveCategoryChangesMock,
    cancelCategoryChanges: cancelCategoryChangesMock,
  }),
}));

jest.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: (...args: unknown[]) => toastMock(...args),
  }),
}));

jest.mock("../SettingsStickyFooter", () => ({
  SettingsStickyFooter: (props: SettingsStickyFooterProps) => {
    stickyFooterProps.push(props);
    return (
      <div data-testid="sticky-footer">
        <button onClick={props.onSave}>save</button>
        <button onClick={props.onCancel}>cancel</button>
      </div>
    );
  },
}));

describe("SettingsPageWrapper", () => {
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ["performance"] });
    stickyFooterProps.length = 0;
    toastMock.mockClear();
    hasCategoryChangesMock.mockReset();
    saveCategoryChangesMock.mockReset();
    cancelCategoryChangesMock.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders children and shows sticky footer when changes exist", () => {
    hasCategoryChangesMock.mockReturnValue(true);
    render(
      <SettingsPageWrapper>
        <div>Settings Content</div>
      </SettingsPageWrapper>
    );

    expect(screen.getByText("Settings Content")).toBeInTheDocument();
    expect(stickyFooterProps.at(-1)?.show).toBe(true);
  });

  it("handles successful save and emits success toast", async () => {
    hasCategoryChangesMock.mockReturnValue(true);
    saveCategoryChangesMock.mockResolvedValue(undefined);

    render(
      <SettingsPageWrapper>
        <div />
      </SettingsPageWrapper>
    );

    const latest = stickyFooterProps.at(-1)!;

    await act(async () => {
      await latest.onSave();
    });

    expect(saveCategoryChangesMock).toHaveBeenCalledWith("/settings/general");
    expect(toastMock).toHaveBeenCalledWith({
      title: "Settings saved",
      description: "Your changes have been saved successfully.",
    });

    const hadSuccessState = stickyFooterProps.some((props) => props.showSuccess);
    expect(hadSuccessState).toBe(true);

    act(() => {
      jest.runAllTimers();
    });

    expect(stickyFooterProps.at(-1)?.showSuccess).toBe(false);
  });

  it("surfaces errors when save fails", async () => {
    const error = new Error("failure");
    hasCategoryChangesMock.mockReturnValue(true);
    saveCategoryChangesMock.mockRejectedValue(error);
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    render(
      <SettingsPageWrapper>
        <div />
      </SettingsPageWrapper>
    );

    const latest = stickyFooterProps.at(-1)!;

    await act(async () => {
      await latest.onSave();
    });

    expect(saveCategoryChangesMock).toHaveBeenCalledWith("/settings/general");
    expect(toastMock).toHaveBeenCalledWith({
      title: "Error",
      description: "Failed to save settings. Please try again.",
      variant: "destructive",
    });
    expect(stickyFooterProps.at(-1)?.isSaving).toBe(false);
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it("cancels pending changes and shows toast", () => {
    hasCategoryChangesMock.mockReturnValue(true);
    render(
      <SettingsPageWrapper>
        <div />
      </SettingsPageWrapper>
    );

    fireEvent.click(screen.getByText("cancel"));

    expect(cancelCategoryChangesMock).toHaveBeenCalledWith("/settings/general");
    expect(toastMock).toHaveBeenCalledWith({
      title: "Changes discarded",
      description: "Your unsaved changes have been discarded.",
    });
    expect(stickyFooterProps.at(-1)?.show).toBe(true);
  });
});
