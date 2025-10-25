jest.mock("@/hooks/useOrganizationSettings", () => ({
  useOrganizationSettings: jest.fn(),
}));

jest.mock("@/lib/dateFormatUtils", () => ({
  formatDateTimeInTimezone: jest.fn((date, tz, options) => `dt:${tz}:${options?.dateFormat}:${options?.timeFormat}`),
  formatDateInTimezone: jest.fn((date, tz, format) => `d:${tz}:${format}`),
  formatTimeInTimezone: jest.fn((date, tz, format) => `t:${tz}:${format}`),
  convertToOrgTimezone: jest.fn((date, tz) => ({ tz, date })),
  convertFromOrgTimezone: jest.fn((date, tz) => ({ tz, date })),
  detectBrowserTimezone: jest.fn(() => "Browser/Timezone"),
}));

import { renderHook } from "@testing-library/react";

import { useOrganizationTimezone } from "../useOrganizationTimezone";
import { useOrganizationSettings } from "@/hooks/useOrganizationSettings";
import {
  formatDateTimeInTimezone,
  formatDateInTimezone,
  formatTimeInTimezone,
  convertToOrgTimezone,
  convertFromOrgTimezone,
  detectBrowserTimezone,
} from "@/lib/dateFormatUtils";

const useOrganizationSettingsMock = useOrganizationSettings as jest.Mock;

describe("useOrganizationTimezone", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("uses organization settings when available", () => {
    useOrganizationSettingsMock.mockReturnValue({
      settings: {
        timezone: "Europe/Istanbul",
        date_format: "YYYY-MM-DD",
        time_format: "24-hour",
      },
      loading: false,
    });

    const { result } = renderHook(() => useOrganizationTimezone());

    expect(result.current.timezone).toBe("Europe/Istanbul");
    expect(result.current.dateFormat).toBe("YYYY-MM-DD");
    expect(result.current.timeFormat).toBe("24-hour");

    const sampleDate = "2025-05-10T12:00:00Z";
    expect(result.current.formatDateTime(sampleDate)).toBe("dt:Europe/Istanbul:YYYY-MM-DD:24-hour");
    expect(formatDateTimeInTimezone).toHaveBeenCalledWith(sampleDate, "Europe/Istanbul", {
      dateFormat: "YYYY-MM-DD",
      timeFormat: "24-hour",
    });

    expect(result.current.formatDate(sampleDate)).toBe("d:Europe/Istanbul:YYYY-MM-DD");
    expect(formatDateInTimezone).toHaveBeenCalledWith(sampleDate, "Europe/Istanbul", "YYYY-MM-DD");

    expect(result.current.formatTime(sampleDate)).toBe("t:Europe/Istanbul:24-hour");
    expect(formatTimeInTimezone).toHaveBeenCalledWith(sampleDate, "Europe/Istanbul", "24-hour");

    const orgDate = result.current.toOrgTimezone(sampleDate);
    expect(convertToOrgTimezone).toHaveBeenCalledWith(sampleDate, "Europe/Istanbul");
    expect(orgDate).toEqual({ tz: "Europe/Istanbul", date: sampleDate });

    const utcDate = result.current.fromOrgTimezone({} as Date);
    expect(convertFromOrgTimezone).toHaveBeenCalledWith({} as Date, "Europe/Istanbul");
    expect(utcDate).toEqual({ tz: "Europe/Istanbul", date: {} });

    const now = result.current.getCurrentTime();
    expect(now).toEqual({ tz: "Europe/Istanbul", date: expect.any(Date) });

    result.current.getCurrentTimeString();
    expect(formatTimeInTimezone).toHaveBeenCalledWith(expect.any(Date), "Europe/Istanbul", "24-hour");
  });

  it("falls back to browser timezone when settings missing", () => {
    (detectBrowserTimezone as jest.Mock).mockReturnValueOnce("Etc/UTC");
    useOrganizationSettingsMock.mockReturnValue({
      settings: undefined,
      loading: true,
    });

    const { result } = renderHook(() => useOrganizationTimezone());

    expect(result.current.timezone).toBe("Etc/UTC");
    expect(result.current.dateFormat).toBe("DD/MM/YYYY");
    expect(result.current.timeFormat).toBe("12-hour");
    expect(result.current.loading).toBe(true);
  });
});
