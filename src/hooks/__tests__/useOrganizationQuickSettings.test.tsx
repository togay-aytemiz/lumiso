jest.mock("@/hooks/useOrganizationSettings", () => ({
  useOrganizationSettings: jest.fn(),
}));

import { renderHook } from "@testing-library/react";

import { useOrganizationQuickSettings } from "../useOrganizationQuickSettings";
import { useOrganizationSettings } from "@/hooks/useOrganizationSettings";

const useOrganizationSettingsMock = useOrganizationSettings as jest.Mock;

describe("useOrganizationQuickSettings", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns quick settings with default true when value undefined", () => {
    useOrganizationSettingsMock.mockReturnValue({
      settings: undefined,
      loading: false,
      refreshSettings: jest.fn(),
    });

    const { result } = renderHook(() => useOrganizationQuickSettings());

    expect(result.current.loading).toBe(false);
    expect(result.current.settings).toEqual({
      show_quick_status_buttons: true,
    });
  });

  it("passes through existing setting and refetch function", () => {
    const refreshSettings = jest.fn();
    useOrganizationSettingsMock.mockReturnValue({
      settings: { show_quick_status_buttons: false },
      loading: true,
      refreshSettings,
    });

    const { result } = renderHook(() => useOrganizationQuickSettings());

    expect(result.current.loading).toBe(true);
    expect(result.current.settings.show_quick_status_buttons).toBe(false);

    result.current.refetch();
    expect(refreshSettings).toHaveBeenCalled();
  });
});
