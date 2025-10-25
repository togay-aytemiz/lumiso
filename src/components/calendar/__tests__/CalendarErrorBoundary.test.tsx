import { fireEvent, render, screen } from "@/utils/testUtils";
import { CalendarErrorBoundary, CalendarErrorWrapper } from "../CalendarErrorBoundary";

describe("CalendarErrorBoundary", () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = "test";
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    jest.restoreAllMocks();
  });

  it("renders fallback UI when a child throws and supports retry", () => {
    const retry = jest.fn();
    const Thrower = () => {
      throw new Error("calendar failed");
    };

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);

    render(
      <CalendarErrorBoundary retry={retry}>
        <Thrower />
      </CalendarErrorBoundary>
    );

    expect(screen.getByText("Calendar Load Failed")).toBeInTheDocument();
    expect(screen.queryByText("Error Details")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Retry"));
    expect(retry).toHaveBeenCalled();

    expect(screen.getByText("Refresh Page")).toBeInTheDocument();

    consoleSpy.mockRestore();
  });

  it("uses provided error prop and hides fallback when cleared", () => {
    const { rerender } = render(
      <CalendarErrorWrapper error={new Error("from hook")}>
        <div>child</div>
      </CalendarErrorWrapper>
    );

    expect(screen.getByText("Calendar Load Failed")).toBeInTheDocument();

    rerender(
      <CalendarErrorWrapper error={null}>
        <div>child</div>
      </CalendarErrorWrapper>
    );

    expect(screen.queryByText("Calendar Load Failed")).not.toBeInTheDocument();
    expect(screen.getByText("child")).toBeInTheDocument();
  });
});
