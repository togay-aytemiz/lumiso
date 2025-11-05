import React from "react";
import { buildProjectSummaryItems } from "./buildProjectSummaryItems";
import type { ProjectHeaderPaymentSummary, ProjectHeaderServicesSummary, ProjectHeaderTodoSummary } from "@/hooks/useProjectHeaderSummary";
import type { ProjectSessionsSummary } from "@/hooks/useProjectSessionsSummary";

jest.mock("@/lib/utils", () => ({
  formatDate: jest.fn((value: string) => `date(${value})`),
  formatTime: jest.fn((value: string) => `time(${value})`),
}));

const RealDate = Date;

function setCurrentDate(isoDate: string) {
  const fixedDate = new RealDate(isoDate);

  class MockDate extends RealDate {
    constructor(...args: ConstructorParameters<typeof Date>) {
      if (args.length) {
        super(...args);
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

const emptySessions: ProjectSessionsSummary = {
  total: 0,
  activeCount: 0,
  completedCount: 0,
  cancelledCount: 0,
  overdueCount: 0,
  overdueNext: null,
  todayCount: 0,
  todayNext: null,
  nextUpcoming: null,
  latestCompleted: null,
};

describe("buildProjectSummaryItems", () => {
  beforeAll(() => {
    setCurrentDate("2025-01-15T10:00:00Z");
  });

  afterAll(() => {
    globalThis.Date = RealDate;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const createTranslator = () =>
    jest.fn((key: string, options?: Record<string, unknown>) =>
      options ? `${key}|${JSON.stringify(options)}` : key
    );

  const basePayments: ProjectHeaderPaymentSummary = {
    totalPaid: 0,
    total: 0,
    remaining: 0,
    currency: "TRY",
  };

  const baseTodos: ProjectHeaderTodoSummary = {
    total: 0,
    completed: 0,
  };

  const baseServices: ProjectHeaderServicesSummary = {
    total: 0,
    names: [],
    totalValue: 0,
  };

  it("returns default messaging when there is no activity data", () => {
    const t = createTranslator();

    const items = buildProjectSummaryItems({
      t,
      payments: basePayments,
      todos: baseTodos,
      services: baseServices,
      sessionsSummary: emptySessions,
    });

    expect(items).toHaveLength(4);

    expect(items[0]).toMatchObject({
      key: "payments",
      primary: "projectDetail.header.payments.primaryZero",
      secondary: "projectDetail.header.payments.secondaryZero",
      secondaryClassName: undefined,
    });

    expect(items[1]).toMatchObject({
      key: "sessions",
      primary: "projectDetail.header.sessions.none",
      secondary: "projectDetail.header.sessions.hint",
      secondaryClassName: "text-muted-foreground",
    });

    expect(items[2]).toMatchObject({
      key: "todos",
      primary: "projectDetail.header.todos.none",
      secondary: "projectDetail.header.todos.hint",
    });

    expect(items[3]).toMatchObject({
      key: "services",
      primary: "projectDetail.header.services.none",
      secondary: "projectDetail.header.services.hint",
      info: undefined,
    });
  });

  it("builds rich summary information when activity data exists", () => {
    const t = createTranslator();

    const payments: ProjectHeaderPaymentSummary = {
      totalPaid: 500,
      total: 500,
      remaining: 0,
      currency: "USD",
    };

    const todos: ProjectHeaderTodoSummary = {
      total: 4,
      completed: 1,
    };

    const services: ProjectHeaderServicesSummary = {
      total: 2,
      names: ["Album Design", "Print Package"],
      totalValue: 250,
    };

    const sessionsSummary: ProjectSessionsSummary = {
      total: 5,
      activeCount: 3,
      completedCount: 1,
      cancelledCount: 1,
      overdueCount: 1,
      overdueNext: {
        id: "overdue-1",
        session_date: "2025-01-10",
        session_time: "10:00:00",
        status: "planned",
      },
      todayCount: 2,
      todayNext: {
        id: "today-1",
        session_date: "2025-01-15",
        session_time: "14:30:00",
        status: "planned",
      },
      nextUpcoming: {
        id: "upcoming-1",
        session_date: "2025-01-16",
        session_time: "09:00:00",
        status: "planned",
      },
      latestCompleted: null,
    };

    const items = buildProjectSummaryItems({
      t,
      payments,
      todos,
      services,
      sessionsSummary,
    });

    expect(items[0].primary).toContain("projectDetail.header.payments.primary|");
    expect(items[0].secondary).toContain("projectDetail.header.payments.paidInFull");
    expect(items[0].secondaryClassName).toBe("text-emerald-600");

    expect(items[1].primary).toContain("projectDetail.header.sessions.count|");
    const sessionContainer = items[1].secondary as React.ReactElement;
    const chipTexts = React.Children.toArray(sessionContainer.props.children as React.ReactNode[])
      .map(child => {
        if (!React.isValidElement(child)) {
          return String(child);
        }
        return React.Children.toArray(child.props.children).join("");
      });

    expect(chipTexts.join("|")).toContain("projectDetail.header.sessions.chips.overdue|");
    expect(chipTexts.join("|")).toContain("projectDetail.header.sessions.chips.todayMultiple|");
    expect(chipTexts.join("|")).toContain("projectDetail.header.sessions.chips.tomorrow|");
    expect(items[1].secondaryClassName).toBeUndefined();

    expect(items[2].primary).toBe("projectDetail.header.todos.primary|{\"completed\":1,\"total\":4}");
    expect(items[2].secondary).toBe("projectDetail.header.todos.secondary|{\"progress\":25}");

    expect(items[3].primary).toBe("projectDetail.header.services.primary|{\"count\":2}");
    expect(items[3].secondary).toBe("projectDetail.header.services.viewList");
    expect(items[3].info).toBeDefined();
    const infoContent = items[3].info?.content as React.ReactElement;
    const infoChildren = React.Children.toArray(infoContent.props.children);
    const listElement = infoChildren.find(
      child => React.isValidElement(child) && child.type === "ul"
    ) as React.ReactElement | undefined;
    const listItems = listElement
      ? React.Children.toArray(listElement.props.children)
      : [];
    const listTexts = listItems.map(item =>
      React.isValidElement(item) ? React.Children.toArray(item.props.children).join("") : String(item)
    );

    expect(listTexts).toContain("Album Design");
    expect(listTexts).toContain("Print Package");

    const translationKeys = t.mock.calls.map(([key]) => key);
    expect(translationKeys).toContain("projectDetail.header.sessions.chips.todayMultiple");
    expect(translationKeys).toContain("projectDetail.header.sessions.chips.tomorrow");
    expect(translationKeys).not.toContain("projectDetail.header.sessions.hint");
  });
});
