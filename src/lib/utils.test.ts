import { enUS, tr } from "date-fns/locale";
import {
  getUserLocale,
  getDateFnsLocale,
  formatDate,
  formatTime,
  formatDateTime,
  formatLongDate,
  getStartOfWeek,
  getEndOfWeek,
  getWeekRange,
} from "./utils";

process.env.TZ = "UTC";

const ORIGINAL_NAVIGATOR = globalThis.navigator;

beforeEach(() => {
  Object.defineProperty(globalThis, "navigator", {
    value: { language: "en-US" },
    writable: true,
    configurable: true,
  });
});

afterAll(() => {
  if (ORIGINAL_NAVIGATOR) {
    Object.defineProperty(globalThis, "navigator", {
      value: ORIGINAL_NAVIGATOR,
      configurable: true,
    });
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).navigator;
  }
});

describe("getUserLocale", () => {
  it("returns navigator language when available", () => {
    Object.defineProperty(globalThis, "navigator", {
      value: { language: "tr-TR" },
      writable: true,
      configurable: true,
    });

    expect(getUserLocale()).toBe("tr-TR");
  });

  it("falls back to en-US when navigator is unavailable", () => {
    Object.defineProperty(globalThis, "navigator", {
      value: {} as Navigator,
      writable: true,
      configurable: true,
    });
    expect(getUserLocale()).toBe("en-US");
  });
});

describe("date and time formatting helpers", () => {
  it("formats dates using provided locale", () => {
    const dateString = "2024-05-15";

    expect(formatDate(dateString, "en-US")).toBe("05/15/2024");
    expect(formatDate(dateString, "tr-TR")).toBe("15.05.2024");
  });

  it("formats times with 12/24 hour detection", () => {
    const timeString = "15:30";

    expect(formatTime(timeString, "en-US")).toBe("03:30 PM");
    expect(formatTime(timeString, "tr-TR")).toBe("15:30");
    expect(formatTime(timeString, "en-US", "24-hour")).toBe("15:30");
  });

  it("formats combined date and time respecting locale preferences", () => {
    const resultUS = formatDateTime("2024-05-15", "15:30", "en-US");
    const resultTR = formatDateTime("2024-05-15", "15:30", "tr-TR");

    expect(resultUS).toBe("05/15/2024, 03:30 PM");
    expect(resultTR).toBe("15.05.2024 15:30");
  });

  it("returns long date representation", () => {
    const value = formatLongDate("2024-05-15", "en-US");
    expect(value).toBe("Wed, May 15, 2024");
  });

  it("exposes correct date-fns locale mapping", () => {
    expect(getDateFnsLocale()).toBe(enUS);

    Object.defineProperty(globalThis, "navigator", {
      value: { language: "tr-TR" },
      writable: true,
      configurable: true,
    });

    const locale = getDateFnsLocale();
    expect(locale).toBe(tr);
  });

  it("allows overriding locale resolution manually", () => {
    expect(getDateFnsLocale("tr")).toBe(tr);
    expect(getDateFnsLocale("en")).toBe(enUS);
  });
});

describe("week boundary helpers", () => {
  const referenceDate = new Date("2024-05-15T12:00:00Z"); // Wednesday

  it("starts weeks on Sunday for en-US", () => {
    const start = getStartOfWeek(referenceDate, "en-US");
    const end = getEndOfWeek(referenceDate, "en-US");

    expect(start.getDay()).toBe(0);
    expect(end.getDay()).toBe(6);
    expect(start.getTime()).toBeLessThan(referenceDate.getTime());
    expect(end.getTime()).toBeGreaterThan(referenceDate.getTime());
    expect(end.getTime() - start.getTime()).toBe(6 * 24 * 60 * 60 * 1000 + 23 * 60 * 60 * 1000 + 59 * 60 * 1000 + 59 * 1000 + 999);
  });

  it("starts weeks on Monday for tr-TR", () => {
    const start = getStartOfWeek(referenceDate, "tr-TR");
    const end = getEndOfWeek(referenceDate, "tr-TR");

    expect(start.getDay()).toBe(1);
    expect(end.getDay()).toBe(0);
    expect(start.getTime()).toBeLessThan(referenceDate.getTime());
    expect(end.getTime()).toBeGreaterThan(referenceDate.getTime());
  });

  it("returns inclusive week range", () => {
    const { start, end } = getWeekRange(referenceDate, "en-US");

    expect(start.getDay()).toBe(0);
    expect(end.getDay()).toBe(6);
    expect(end.getTime()).toBeGreaterThan(start.getTime());
  });
});
