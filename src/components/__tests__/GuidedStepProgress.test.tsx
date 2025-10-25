import { act, render, screen } from "@/utils/testUtils";
import { GuidedStepProgress } from "../GuidedStepProgress";
import { useFormsTranslation } from "@/hooks/useTypedTranslation";

type Mocked<T> = jest.MockedFunction<T>;

jest.mock("@/hooks/useTypedTranslation", () => ({
  useFormsTranslation: jest.fn(),
}));

describe("GuidedStepProgress", () => {
  const useFormsTranslationMock: Mocked<typeof useFormsTranslation> = useFormsTranslation as any;
  const translations = {
    "progress.tasks_complete": "tasks complete",
  } as const;

  beforeEach(() => {
    useFormsTranslationMock.mockReturnValue({
      t: (key: string) => translations[key as keyof typeof translations] ?? key,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it("renders the target value immediately when animation is disabled", () => {
    render(
      <GuidedStepProgress
        currentValue={2}
        targetValue={8}
        totalSteps={10}
        animate={false}
      />
    );

    const fraction = screen.getByText((content, element) =>
      element?.classList.contains("tabular-nums") && content.replace(/\s+/g, "") === "8/10"
    );
    expect(fraction).toBeInTheDocument();

    const indicator = screen.getByRole("progressbar").querySelector('[style*="translateX"]');
    expect(indicator).toHaveStyle({ transform: "translateX(-20%)" });
  });

  it("animates towards the target value when enabled", () => {
    jest.useFakeTimers({ doNotFake: ["performance"] });

    render(
      <GuidedStepProgress
        currentValue={1}
        targetValue={6}
        totalSteps={10}
      />
    );

    act(() => {
      jest.runAllTimers();
    });

    const fraction = screen.getByText((content, element) =>
      element?.classList.contains("tabular-nums") && content.replace(/\s+/g, "") === "6/10"
    );
    expect(fraction).toBeInTheDocument();

    const indicator = screen.getByRole("progressbar").querySelector('[style*="translateX"]');
    expect(indicator).toHaveStyle({ transform: "translateX(-40%)" });
  });
});
