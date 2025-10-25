import { act, renderHook } from "@testing-library/react";
import { useKanbanSettings } from "../useKanbanSettings";

const updateSettingsMock = jest.fn();
const useOrgSettingsMock = jest.fn();

jest.mock("@/hooks/useOrganizationSettings", () => ({
  useOrganizationSettings: () => useOrgSettingsMock(),
}));

describe("useKanbanSettings", () => {
  beforeEach(() => {
    updateSettingsMock.mockReset();
    useOrgSettingsMock.mockReturnValue({
      settings: {
        kanban_show_project_type: false,
        kanban_show_todo_progress: false,
        kanban_show_session_count: false,
        kanban_show_service_count: false,
        kanban_show_project_name: false,
        kanban_show_client_name: false,
      },
      loading: false,
      updateSettings: updateSettingsMock,
    });
  });

  it("provides default settings when organization settings missing", () => {
    useOrgSettingsMock.mockReturnValue({
      settings: undefined,
      loading: true,
      updateSettings: updateSettingsMock,
    });

    const { result } = renderHook(() => useKanbanSettings());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.settings).toEqual({
      kanban_show_project_type: true,
      kanban_show_todo_progress: true,
      kanban_show_session_count: true,
      kanban_show_service_count: true,
      kanban_show_project_name: true,
      kanban_show_client_name: true,
    });
  });

  it("memoizes settings and updates via updateSettings", async () => {
    const { result } = renderHook(() => useKanbanSettings());

    expect(result.current.settings.kanban_show_project_type).toBe(false);

    await act(async () => {
      await result.current.updateSettings({ kanban_show_project_type: true });
    });

    expect(updateSettingsMock).toHaveBeenCalledWith({ kanban_show_project_type: true });
    expect(result.current.isUpdating).toBe(false);
  });
});
