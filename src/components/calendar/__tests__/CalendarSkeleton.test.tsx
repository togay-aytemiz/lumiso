import { render } from "@/utils/testUtils";
import { CalendarDaySkeleton, CalendarSkeleton, CalendarWeekSkeleton } from "../CalendarSkeleton";

describe("Calendar skeletons", () => {
  let randomSpy: jest.SpyInstance<number, []>;

  beforeAll(() => {
    randomSpy = jest.spyOn(Math, "random").mockReturnValue(0.9);
  });

  afterAll(() => {
    randomSpy.mockRestore();
  });

  it("renders month skeleton with seven weekday headers and 42 day cells", () => {
    const { container } = render(<CalendarSkeleton />);
    const header = container.querySelector(".grid.grid-cols-7");
    expect(header?.children).toHaveLength(7);

    const dayGrid = container.querySelector(".grid.grid-cols-7.gap-px");
    expect(dayGrid?.children).toHaveLength(42);
  });

  it("renders week skeleton with header and time slot rows", () => {
    const { container } = render(<CalendarWeekSkeleton />);
    const headers = container.querySelectorAll(".grid.grid-cols-8");
    // One header row plus sixteen time-slot rows
    expect(headers.length).toBeGreaterThan(1);
  });

  it("renders day skeleton with session and reminder placeholders", () => {
    const { container } = render(<CalendarDaySkeleton />);
    expect(container.querySelectorAll(".h-16")).toHaveLength(3);
    expect(container.querySelectorAll(".h-12")).toHaveLength(2);
  });
});
