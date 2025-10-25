import {
  sortEntities,
  filterEntities,
  getDateRangeForFilter,
  validateEntityData,
  ValidationRules,
  formatEntityValue,
  debounce,
  getEntityCountForFilter,
  generateStatusColor,
} from "./entityUtils";
import { DATE_FILTER_OPTIONS, VALIDATION_MESSAGES } from "@/constants/entityConstants";

describe("sortEntities", () => {
  const sample = [
    { id: 1, name: "Charlie", score: 42, created_at: "2024-05-16T10:00:00.000Z" },
    { id: 2, name: "alice", score: 75, created_at: "2024-05-14T10:00:00.000Z" },
    { id: 3, name: "Bravo", score: null, created_at: "not a date" },
  ];

  it("sorts by string fields case-insensitively", () => {
    const sorted = sortEntities(sample, "name", "asc");
    expect(sorted.map((entity) => entity.name)).toEqual(["alice", "Bravo", "Charlie"]);
  });

  it("sorts numeric fields with null handling and direction control", () => {
    const sortedAsc = sortEntities(sample, "score", "asc");
    expect(sortedAsc.map((entity) => entity.score)).toEqual([null, 42, 75]);

    const sortedDesc = sortEntities(sample, "score", "desc");
    expect(sortedDesc.map((entity) => entity.score)).toEqual([75, 42, null]);
  });

  it("sorts ISO date strings chronologically when possible", () => {
    const sorted = sortEntities(sample, "created_at", "asc");
    expect(sorted.map((entity) => entity.id)).toEqual([2, 1, 3]);
  });

  it("honors custom comparator modifiers", () => {
    const comparator = jest.fn((a: number | null, b: number | null) => {
      const aValue = a ?? -1;
      const bValue = b ?? -1;
      return aValue - bValue;
    });

    const sorted = sortEntities(sample, "score", "desc", comparator);
    expect(comparator).toHaveBeenCalled();
    expect(sorted.map((entity) => entity.score)).toEqual([75, 42, null]);
  });
});

describe("filterEntities", () => {
  const entities = [
    { id: 1, status: "new", name: "Alice Johnson", email: "alice@example.com" },
    { id: 2, status: "contacted", name: "Bob Smith", email: "bob@example.com" },
    { id: 3, status: "new", name: "Carlos Alvarez", email: "carlos@example.com" },
  ];

  it("applies direct equality filters", () => {
    const filtered = filterEntities(entities, { status: "new" });
    expect(filtered.map((entity) => entity.id)).toEqual([1, 3]);
  });

  it("applies search filters across multiple fields", () => {
    const filtered = filterEntities(
      entities,
      { search: "bob", status: "contacted" },
      ["name", "email"]
    );
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe(2);
  });

  it("ignores empty or all filters", () => {
    const filtered = filterEntities(entities, { status: "all", search: "" }, ["name"]);
    expect(filtered).toHaveLength(3);
  });
});

describe("getDateRangeForFilter", () => {
  const anchor = new Date(2024, 4, 15, 12); // May 15, 2024

  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ["performance"] });
    jest.setSystemTime(anchor);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns expected range for today", () => {
    const range = getDateRangeForFilter("today");
    expect(range).toEqual({
      start: new Date(2024, 4, 15),
      end: new Date(2024, 4, 16),
    });
  });

  it("returns expected range for this week and next week", () => {
    const thisWeek = getDateRangeForFilter("thisweek");
    expect(thisWeek).toEqual({
      start: new Date(2024, 4, 13),
      end: new Date(2024, 4, 20),
    });

    const nextWeek = getDateRangeForFilter("nextweek");
    expect(nextWeek).toEqual({
      start: new Date(2024, 4, 20),
      end: new Date(2024, 4, 27),
    });
  });

  it("returns expected range for month-based filters", () => {
    const thisMonth = getDateRangeForFilter("thismonth");
    expect(thisMonth).toEqual({
      start: new Date(2024, 4, 1),
      end: new Date(2024, 5, 1),
    });

    const nextMonth = getDateRangeForFilter("nextmonth");
    expect(nextMonth).toEqual({
      start: new Date(2024, 5, 1),
      end: new Date(2024, 6, 1),
    });
  });

  it("returns expected range for past and tomorrow", () => {
    const past = getDateRangeForFilter("past");
    expect(past).toEqual({
      start: new Date(0),
      end: new Date(2024, 4, 15),
    });

    const tomorrow = getDateRangeForFilter("tomorrow");
    expect(tomorrow).toEqual({
      start: new Date(2024, 4, 16),
      end: new Date(2024, 4, 17),
    });
  });

  it("returns null for unsupported filters", () => {
    expect(getDateRangeForFilter("custom")).toBeNull();
  });
});

describe("validateEntityData & ValidationRules", () => {
  const rules = {
    name: [ValidationRules.required],
    email: [ValidationRules.required, ValidationRules.email],
    phone: [ValidationRules.phone],
    description: [ValidationRules.minLength(5)],
    shortCode: [ValidationRules.maxLength(5)],
    startDate: [ValidationRules.futureDate],
    endDate: [ValidationRules.pastDate],
    appointmentTime: [ValidationRules.time],
  };

  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ["performance"] });
    jest.setSystemTime(new Date(2024, 4, 15, 9));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("collects validation errors per field respecting rule order", () => {
    const data = {
      name: "",
      email: "invalid-email",
      phone: "12345",
      description: "mini",
      shortCode: "toolong",
      startDate: "2024-05-10",
      endDate: "2024-05-20",
      appointmentTime: "25:00",
    };

    const errors = validateEntityData(data, rules);

    expect(errors).toEqual({
      name: VALIDATION_MESSAGES.REQUIRED,
      email: VALIDATION_MESSAGES.INVALID_EMAIL,
      phone: VALIDATION_MESSAGES.INVALID_PHONE,
      description: VALIDATION_MESSAGES.MIN_LENGTH(5),
      shortCode: VALIDATION_MESSAGES.MAX_LENGTH(5),
      startDate: VALIDATION_MESSAGES.FUTURE_DATE,
      endDate: VALIDATION_MESSAGES.PAST_DATE,
      appointmentTime: VALIDATION_MESSAGES.INVALID_TIME,
    });
  });

  it("returns empty error object when data satisfies rules", () => {
    const data = {
      name: "Valid",
      email: "valid@example.com",
      phone: "(555) 555-5555",
      description: "adequate",
      shortCode: "short",
      startDate: "2024-05-16",
      endDate: "2024-05-10",
      appointmentTime: "14:30",
    };

    expect(validateEntityData(data, rules)).toEqual({});
  });
});

describe("formatEntityValue", () => {
  it("formats dates, times, currency, phone, and email values", () => {
    expect(formatEntityValue("2024-05-15", "date")).toBe("May 15, 2024");
    expect(formatEntityValue("14:30", "time")).toBe("2:30 PM");
    expect(formatEntityValue(1234.5, "currency")).toBe("$1,234.50");
    expect(formatEntityValue("1234567890", "phone")).toBe("(123) 456-7890");
    expect(formatEntityValue("USER@Example.com", "email")).toBe("user@example.com");
    expect(formatEntityValue("Example", "text")).toBe("Example");
  });

  it("returns fallback when value is missing or invalid", () => {
    expect(formatEntityValue(null, "text")).toBe("-");
    expect(formatEntityValue("", "text")).toBe("-");
    expect(formatEntityValue("invalid-date", "date")).toBe("-");
    expect(formatEntityValue("not-a-number", "currency")).toBe("-");
  });
});

describe("debounce", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it("delays execution until wait period elapses", () => {
    jest.useFakeTimers({ doNotFake: ["performance"] });
    const fn = jest.fn();
    const debounced = debounce(fn, 200);

    debounced("first");
    jest.advanceTimersByTime(199);
    expect(fn).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledWith("first");
  });

  it("resets timer on rapid successive calls", () => {
    jest.useFakeTimers({ doNotFake: ["performance"] });
    const fn = jest.fn();
    const debounced = debounce(fn, 200);

    debounced("first");
    jest.advanceTimersByTime(150);
    debounced("second");
    jest.advanceTimersByTime(199);
    expect(fn).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("second");
  });
});

describe("getEntityCountForFilter", () => {
  const entities = [
    { id: 1, status: "new", due_date: "2024-05-14T10:00:00.000Z" },
    { id: 2, status: "new", due_date: "2024-05-15T09:00:00.000Z" },
    { id: 3, status: "contacted", due_date: "2024-05-16T11:00:00.000Z" },
  ];

  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ["performance"] });
    jest.setSystemTime(new Date(2024, 4, 15, 12));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("counts entities by status when non-date filter value", () => {
    const count = getEntityCountForFilter(entities, "status", "new");
    expect(count).toBe(2);
  });

  it("counts all entities when filter is all", () => {
    const count = getEntityCountForFilter(entities, "status", "all");
    expect(count).toBe(3);
  });

  it("counts entities within a date range when filter matches DATE_FILTER_OPTIONS", () => {
    expect(DATE_FILTER_OPTIONS.find((option) => option.key === "today")).toBeTruthy();

    const today = getEntityCountForFilter(entities, "status", "today", "due_date");
    expect(today).toBe(1);

    const past = getEntityCountForFilter(entities, "status", "past", "due_date");
    expect(past).toBe(1);
  });
});

describe("generateStatusColor", () => {
  it("returns predefined colors for known statuses ignoring case", () => {
    expect(generateStatusColor("NEW")).toBe("#A0AEC0");
    expect(generateStatusColor("Completed")).toBe("#22c55e");
  });

  it("uses fallback colors or default gray for unknown statuses", () => {
    expect(generateStatusColor("pending", ["#123456", "#654321"])).toBe("#123456");
    expect(generateStatusColor("pending")).toBe("#A0AEC0");
  });
});
