import { getRelativeDate, getDateDisplayClasses, isOverdueSession } from "./dateUtils";
import { formatDate } from "@/lib/utils";

jest.mock("@/lib/utils", () => ({
  formatDate: jest.fn(),
  formatTime: jest.fn(),
}));

const mockFormatDate = formatDate as jest.MockedFunction<typeof formatDate>;
const RealDate = Date;

function setCurrentDate(isoDate: string) {
  const fixedDate = new RealDate(isoDate);

  class MockDate extends RealDate {
    constructor(...args: any[]) {
      if (args.length) {
        super(...(args as [any]));
        return;
      }
      super(fixedDate.valueOf());
    }
  }

  const MockDateCtor = MockDate as unknown as DateConstructor;
  MockDateCtor.UTC = RealDate.UTC;
  MockDateCtor.parse = RealDate.parse;
  MockDateCtor.now = () => fixedDate.valueOf();

  globalThis.Date = MockDateCtor;
}

describe("dateUtils", () => {
  beforeAll(() => {
    setCurrentDate("2025-01-15T10:00:00");
  });

  afterAll(() => {
    globalThis.Date = RealDate;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("getRelativeDate", () => {
    it("returns fallback English labels for today, tomorrow, and yesterday", () => {
      expect(getRelativeDate("2025-01-15")).toBe("Today");
      expect(getRelativeDate("2025-01-16")).toBe("Tomorrow");
      expect(getRelativeDate("2025-01-14")).toBe("Yesterday");
      expect(mockFormatDate).not.toHaveBeenCalled();
    });

    it("returns localized labels when translator is provided", () => {
      const translations: Record<string, string> = {
        "relativeDates.today": "Bugun",
        "relativeDates.tomorrow": "Yarin",
        "relativeDates.yesterday": "Dun",
      };
      const t = (key: string) => translations[key] ?? key;

      expect(getRelativeDate("2025-01-15", t)).toBe("Bugun");
      expect(getRelativeDate("2025-01-16", t)).toBe("Yarin");
      expect(getRelativeDate("2025-01-14", t)).toBe("Dun");
    });

    it("falls back to formatDate for other dates", () => {
      mockFormatDate.mockReturnValueOnce("Jan 20");

      const result = getRelativeDate("2025-01-20");

      expect(result).toBe("Jan 20");
      expect(mockFormatDate).toHaveBeenCalledWith("2025-01-20");
    });
  });

  describe("isOverdueSession", () => {
    it("returns true when session is before today and still planned", () => {
      expect(isOverdueSession("2025-01-10", "planned")).toBe(true);
    });

    it("returns false when session is today or later", () => {
      expect(isOverdueSession("2025-01-15", "planned")).toBe(false);
      expect(isOverdueSession("2025-01-17", "planned")).toBe(false);
    });

    it("returns false when status is not planned", () => {
      expect(isOverdueSession("2025-01-10", "completed")).toBe(false);
    });
  });

  describe("getDateDisplayClasses", () => {
    const translations: Record<string, string> = {
      "relativeDates.today": "Bugun",
      "relativeDates.tomorrow": "Yarin",
    };
    const t = (key: string) => translations[key] ?? key;

    it("returns highlight classes for today and tomorrow labels", () => {
      expect(getDateDisplayClasses("2025-01-15", t)).toBe(
        "text-primary font-medium"
      );
      expect(getDateDisplayClasses("2025-01-16", t)).toBe(
        "text-primary font-medium"
      );
    });

    it("returns default classes for other dates", () => {
      mockFormatDate.mockReturnValueOnce("Jan 18");
      expect(getDateDisplayClasses("2025-01-18", t)).toBe(
        "text-foreground"
      );
    });
  });
});
