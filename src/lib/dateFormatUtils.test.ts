import * as dateFnsTz from "date-fns-tz";

import {
  formatDateWithOrgSettings,
  formatTimeWithOrgSettings,
  detectBrowserTimezone,
  getSupportedTimezones,
  formatDateTimeInTimezone,
  convertToOrgTimezone,
  convertFromOrgTimezone,
  formatDateInTimezone,
  formatTimeInTimezone,
} from "./dateFormatUtils";

process.env.TZ = "UTC";

afterEach(() => {
  jest.restoreAllMocks();
});

describe("formatDateWithOrgSettings", () => {
  const dateString = "2024-05-15T00:00:00Z";

  it("supports common organization date formats", () => {
    const date = new Date(dateString);

    expect(
      formatDateWithOrgSettings(dateString, { dateFormat: "MM/DD/YYYY" })
    ).toBe(date.toLocaleDateString("en-US"));

    expect(
      formatDateWithOrgSettings(dateString, { dateFormat: "DD/MM/YYYY" })
    ).toBe(date.toLocaleDateString("en-GB"));

    expect(
      formatDateWithOrgSettings(dateString, { dateFormat: "YYYY-MM-DD" })
    ).toBe("2024-05-15");

    expect(
      formatDateWithOrgSettings(dateString, { dateFormat: "DD-MM-YYYY" })
    ).toBe(date.toLocaleDateString("en-GB").replace(/\//g, "-"));

    expect(
      formatDateWithOrgSettings(dateString, { dateFormat: "MM-DD-YYYY" })
    ).toBe(date.toLocaleDateString("en-US").replace(/\//g, "-"));
  });

  it("falls back to locale-aware formatting for custom formats", () => {
    const result = formatDateWithOrgSettings(dateString, {
      dateFormat: "CUSTOM",
      locale: "tr-TR",
    });

    expect(result).toBe("15.05.2024");
  });
});

describe("formatTimeWithOrgSettings", () => {
  it("returns 24 hour time when requested", () => {
    expect(formatTimeWithOrgSettings("15:30", "24-hour")).toBe("15:30");
  });

  it("converts to 12 hour format with AM/PM markers", () => {
    expect(formatTimeWithOrgSettings("00:05", "12-hour")).toBe("12:05 AM");
    expect(formatTimeWithOrgSettings("12:00", "12-hour")).toBe("12:00 PM");
    expect(formatTimeWithOrgSettings("23:15", "12-hour")).toBe("11:15 PM");
  });

  it("returns an empty string for missing input", () => {
    expect(formatTimeWithOrgSettings("", "12-hour")).toBe("");
  });
});

describe("detectBrowserTimezone", () => {
  it("returns the timezone reported by Intl APIs", () => {
    const mock = jest
      .spyOn(Intl, "DateTimeFormat")
      .mockImplementation(
        () =>
          ({
            resolvedOptions: () => ({ timeZone: "America/New_York" }),
          } as unknown as Intl.DateTimeFormat)
      );

    expect(detectBrowserTimezone()).toBe("America/New_York");
    mock.mockRestore();
  });

  it("falls back to UTC when detection fails", () => {
    const mock = jest
      .spyOn(Intl, "DateTimeFormat")
      .mockImplementation(() => {
        throw new Error("Intl not available");
      });

    expect(detectBrowserTimezone()).toBe("UTC");
    mock.mockRestore();
  });
});

describe("getSupportedTimezones", () => {
  it("returns alphabetically sorted timezone metadata", () => {
    const supported = getSupportedTimezones();
    const labels = supported.map((entry) => entry.label);
    const sortedLabels = [...labels].sort((a, b) => a.localeCompare(b));

    expect(labels).toEqual(sortedLabels);
    expect(supported).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          value: "Europe/Istanbul",
          label: "Istanbul (Europe/Istanbul)",
          region: "Europe",
        }),
      ])
    );
  });
});

describe("formatDateTimeInTimezone", () => {
  const baseDate = "2024-05-15T15:30:00Z";

  it("formats date and time in 24 hour mode for the requested timezone", () => {
    const formatted = formatDateTimeInTimezone(baseDate, "America/New_York", {
      dateFormat: "MM/DD/YYYY",
      timeFormat: "24-hour",
    });

    expect(formatted).toBe("05/15/2024 11:30");
  });

  it("formats date and time in 12 hour mode with localized date", () => {
    const formatted = formatDateTimeInTimezone(baseDate, "Europe/Istanbul", {
      dateFormat: "DD/MM/YYYY",
      timeFormat: "12-hour",
    });

    expect(formatted).toBe("15/05/2024 6:30 PM");
  });

  it("falls back to date formatting when timezone formatting fails", () => {
    const spy = jest
      .spyOn(dateFnsTz, "formatInTimeZone")
      .mockImplementationOnce(() => {
        throw new Error("formatting failed");
      });

    const formatted = formatDateTimeInTimezone(baseDate, "UTC", {
      dateFormat: "MM/DD/YYYY",
    });

    expect(formatted).toBe(new Date(baseDate).toLocaleDateString("en-US"));
    spy.mockRestore();
  });
});

describe("convertToOrgTimezone", () => {
  const baseDate = "2024-05-15T15:30:00Z";

  it("shifts a UTC date into the chosen organization timezone", () => {
    const zoned = convertToOrgTimezone(baseDate, "America/Los_Angeles");

    const roundTripped = convertFromOrgTimezone(zoned, "America/Los_Angeles");
    expect(roundTripped.toISOString()).toBe(new Date(baseDate).toISOString());
  });

  it("returns the original value when conversion fails", () => {
    const spy = jest
      .spyOn(dateFnsTz, "toZonedTime")
      .mockImplementationOnce(() => {
        throw new Error("conversion failed");
      });

    const result = convertToOrgTimezone(baseDate, "Invalid/Timezone");
    expect(result.toISOString()).toBe(new Date(baseDate).toISOString());
    spy.mockRestore();
  });
});

describe("convertFromOrgTimezone", () => {
  const utcDate = new Date("2024-05-15T15:30:00Z");
  const localDate = dateFnsTz.toZonedTime(utcDate, "America/New_York");

  it("converts a local timezone date back to UTC", () => {
    const converted = convertFromOrgTimezone(localDate, "America/New_York");

    expect(converted.toISOString()).toBe("2024-05-15T15:30:00.000Z");
  });

  it("returns the original value when reverse conversion fails", () => {
    const spy = jest
      .spyOn(dateFnsTz, "fromZonedTime")
      .mockImplementationOnce(() => {
        throw new Error("conversion failed");
      });

    const result = convertFromOrgTimezone(localDate, "Invalid/Timezone");
    expect(result).toBe(localDate);
    spy.mockRestore();
  });
});

describe("formatDateInTimezone", () => {
  it("formats a date in the requested timezone and format", () => {
    const formatted = formatDateInTimezone(
      "2024-01-01T01:30:00Z",
      "America/Los_Angeles",
      "MM/DD/YYYY"
    );

    expect(formatted).toBe("12/31/2023");
  });

  it("falls back to organization date formatting when conversion fails", () => {
    const spy = jest
      .spyOn(dateFnsTz, "formatInTimeZone")
      .mockImplementationOnce(() => {
        throw new Error("formatting failed");
      });

    const formatted = formatDateInTimezone("2024-05-15T00:00:00Z", "UTC", "DD/MM/YYYY");
    expect(formatted).toBe(
      new Date("2024-05-15T00:00:00Z").toLocaleDateString("en-GB")
    );
    spy.mockRestore();
  });
});

describe("formatTimeInTimezone", () => {
  it("returns formatted output for time-only entries", () => {
    expect(formatTimeInTimezone("09:15", "UTC", "12-hour")).toBe("9:15 AM");
    expect(formatTimeInTimezone("09:15", "UTC", "24-hour")).toBe("09:15");
  });

  it("formats date strings in the requested timezone", () => {
    const baseDate = "2024-05-15T15:30:00Z";

    expect(
      formatTimeInTimezone(baseDate, "America/New_York", "24-hour")
    ).toBe("11:30");

    expect(
      formatTimeInTimezone(baseDate, "America/New_York", "12-hour")
    ).toBe("11:30 AM");
  });

  it("returns an empty string for invalid inputs", () => {
    expect(formatTimeInTimezone("not-a-date", "UTC", "12-hour")).toBe("");
  });

  it("falls back to an empty string when timezone formatting fails", () => {
    const spy = jest
      .spyOn(dateFnsTz, "formatInTimeZone")
      .mockImplementationOnce(() => {
        throw new Error("formatting failed");
      });

    expect(
      formatTimeInTimezone("2024-05-15T15:30:00Z", "UTC", "24-hour")
    ).toBe("");
    spy.mockRestore();
  });
});
