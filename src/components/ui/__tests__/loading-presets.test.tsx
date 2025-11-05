import { render, screen } from "@testing-library/react";
import type { ComponentType } from "react";
import {
  PageLoadingSkeleton,
  DashboardLoadingSkeleton,
  TableLoadingSkeleton,
  ListLoadingSkeleton,
  KanbanLoadingSkeleton,
  FormLoadingSkeleton,
  SearchLoadingSkeleton,
  CompactLoadingSkeleton,
  CardGridLoadingSkeleton,
  DetailPageLoadingSkeleton,
  SettingsLoadingSkeleton,
} from "../loading-presets";

jest.mock("../loading-skeleton", () => {
  type LoadingSkeletonProps = {
    variant?: string;
    rows?: number;
    showHeader?: boolean;
    showActions?: boolean;
    className?: string;
  };

  return {
    __esModule: true,
    LoadingSkeleton: ({
      variant,
      rows,
      showHeader,
      showActions,
      className,
    }: LoadingSkeletonProps) => {
      return (
        <div
          data-testid="loading-skeleton"
          data-variant={variant ?? ""}
          data-rows={rows != null ? String(rows) : ""}
          data-show-header={showHeader ? "true" : "false"}
          data-show-actions={showActions ? "true" : "false"}
          data-class-name={className ?? ""}
        />
      );
    },
  };
});

describe("loading-presets", () => {
  type SkeletonCase = {
    name: string;
    Component: ComponentType<Record<string, unknown>>;
    props?: Record<string, unknown>;
    expected: {
      variant: string;
      rows?: string;
      showHeader?: boolean;
      showActions?: boolean;
      classForwarded?: boolean;
    };
    wrapperClasses?: string[];
  };

  const skeletonCases: SkeletonCase[] = [
    {
      name: "PageLoadingSkeleton",
      Component: PageLoadingSkeleton,
      expected: {
        variant: "settings",
        rows: "3",
        showHeader: true,
        showActions: false,
        classForwarded: true,
      },
    },
    {
      name: "DashboardLoadingSkeleton",
      Component: DashboardLoadingSkeleton,
      expected: {
        variant: "dashboard",
        showHeader: false,
        showActions: false,
        classForwarded: false,
      },
      wrapperClasses: ["p-4", "sm:p-6"],
    },
    {
      name: "TableLoadingSkeleton",
      Component: TableLoadingSkeleton,
      props: { rows: 4 },
      expected: {
        variant: "table",
        rows: "4",
        showHeader: true,
        showActions: false,
        classForwarded: false,
      },
      wrapperClasses: ["p-4"],
    },
    {
      name: "ListLoadingSkeleton",
      Component: ListLoadingSkeleton,
      props: { rows: 2 },
      expected: {
        variant: "list",
        rows: "2",
        showHeader: true,
        showActions: true,
        classForwarded: false,
      },
      wrapperClasses: ["p-4"],
    },
    {
      name: "KanbanLoadingSkeleton",
      Component: KanbanLoadingSkeleton,
      expected: {
        variant: "kanban",
        showHeader: false,
        showActions: false,
        classForwarded: false,
      },
      wrapperClasses: ["p-4", "sm:p-6"],
    },
    {
      name: "FormLoadingSkeleton",
      Component: FormLoadingSkeleton,
      props: { rows: 7 },
      expected: {
        variant: "form",
        rows: "7",
        showHeader: true,
        showActions: true,
        classForwarded: false,
      },
      wrapperClasses: ["p-6"],
    },
    {
      name: "SearchLoadingSkeleton",
      Component: SearchLoadingSkeleton,
      props: { rows: 6 },
      expected: {
        variant: "search",
        rows: "6",
        showHeader: false,
        showActions: false,
        classForwarded: false,
      },
      wrapperClasses: ["p-4"],
    },
    {
      name: "DetailPageLoadingSkeleton",
      Component: DetailPageLoadingSkeleton,
      expected: {
        variant: "detail-page",
        showHeader: false,
        showActions: false,
        classForwarded: true,
      },
    },
    {
      name: "SettingsLoadingSkeleton",
      Component: SettingsLoadingSkeleton,
      props: { rows: 4 },
      expected: {
        variant: "settings",
        rows: "4",
        showHeader: true,
        showActions: true,
        classForwarded: true,
      },
    },
  ];

  it.each(skeletonCases)(
    "%s forwards the correct skeleton props",
    ({ Component, props = {}, expected, wrapperClasses }) => {
      const { container } = render(<Component className="extra" {...props} />);

      const skeleton = screen.getByTestId("loading-skeleton");
      expect(skeleton).toHaveAttribute("data-variant", expected.variant);

      if (expected.rows !== undefined) {
        expect(skeleton).toHaveAttribute("data-rows", expected.rows);
      } else {
        expect(skeleton).toHaveAttribute("data-rows", "");
      }

      if (expected.showHeader !== undefined) {
        expect(skeleton).toHaveAttribute(
          "data-show-header",
          expected.showHeader ? "true" : "false"
        );
      }

      if (expected.showActions !== undefined) {
        expect(skeleton).toHaveAttribute(
          "data-show-actions",
          expected.showActions ? "true" : "false"
        );
      }

      const forwardedClass = expected.classForwarded ? "extra" : "";
      expect(skeleton).toHaveAttribute("data-class-name", forwardedClass);

      if (wrapperClasses?.length) {
        const wrapper = container.firstChild as HTMLElement | null;
        expect(wrapper).not.toBeNull();
        wrapperClasses.forEach((className) => {
          expect(wrapper).toHaveClass(className);
        });
        expect(wrapper).toHaveClass("extra");
      }
    }
  );

  it("CompactLoadingSkeleton renders spinner with merged classes", () => {
    const { container } = render(<CompactLoadingSkeleton className="extra" />);

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass("flex", "items-center", "justify-center", "py-8", "extra");
    const spinner = wrapper.querySelector(".animate-spin") as HTMLElement | null;
    expect(spinner).not.toBeNull();
    expect(spinner).toHaveClass(
      "h-6",
      "w-6",
      "border-2",
      "border-primary",
      "border-t-transparent",
      "rounded-full"
    );
  });

  it("CardGridLoadingSkeleton renders the requested number of cards", () => {
    const { container } = render(
      <CardGridLoadingSkeleton className="extra" count={4} />
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass(
      "grid",
      "gap-4",
      "md:grid-cols-2",
      "lg:grid-cols-3",
      "p-4",
      "extra"
    );

    const cards = container.querySelectorAll(
      ".animate-pulse.border.rounded-lg"
    );
    expect(cards).toHaveLength(4);
  });
});
