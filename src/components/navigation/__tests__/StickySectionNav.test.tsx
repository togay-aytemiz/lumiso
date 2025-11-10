import { act, fireEvent, render, screen } from "@/utils/testUtils";
import { StickySectionNav, StickySectionNavProps } from "../StickySectionNav";

type IOCallback = (entries: IntersectionObserverEntry[]) => void;

const observeMock = jest.fn();
const disconnectMock = jest.fn();
let intersectionCallback: IOCallback | null = null;
const scrollToMock = jest.fn();

class FakeIntersectionObserver {
  constructor(callback: IOCallback) {
    intersectionCallback = callback;
  }
  observe = observeMock;
  disconnect = disconnectMock;
}

describe("StickySectionNav", () => {
  beforeEach(() => {
    observeMock.mockClear();
    disconnectMock.mockClear();
    intersectionCallback = null;
    scrollToMock.mockClear();
    // @ts-expect-error - assign test double
    global.IntersectionObserver = FakeIntersectionObserver;
    Object.defineProperty(window, "scrollTo", {
      value: scrollToMock,
      writable: true,
    });
    Object.defineProperty(window, "scrollY", {
      value: 0,
      writable: true,
    });
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  const baseItems: StickySectionNavProps["items"] = [
    { id: "section-1", title: "Section 1" },
    { id: "section-2", title: "Section 2" },
    { id: "section-3", title: "Section 3" },
  ];

  it("renders buttons and applies fallback active id", () => {
    render(
      <StickySectionNav items={baseItems} fallbackActiveId="section-2" />
    );

    expect(screen.getAllByRole("button")).toHaveLength(3);
    expect(
      screen.getByRole("button", { name: "Section 2" })
    ).toHaveAttribute("aria-current", "page");
  });

  it("invokes custom onSelect when provided", () => {
    const onSelect = jest.fn();
    const items = [
      ...baseItems.slice(0, 1),
      { id: "section-2", title: "Section 2", onSelect },
      baseItems[2],
    ];

    render(<StickySectionNav items={items} />);

    fireEvent.click(screen.getByRole("button", { name: "Section 2" }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("does not render when below the minimum item threshold", () => {
    render(
      <StickySectionNav
        items={[baseItems[0]]}
        minItemsToShow={2}
      />
    );

    expect(screen.queryByRole("button")).toBeNull();
  });

  it("scrolls window to section when onSelect is absent", () => {
    const target = document.createElement("div");
    target.id = "section-3";
    target.getBoundingClientRect = () =>
      ({
        top: 400,
        bottom: 420,
        left: 0,
        right: 0,
        height: 20,
        width: 0,
        x: 0,
        y: 400,
        toJSON: () => ({}),
      }) as DOMRect;
    document.body.appendChild(target);

    render(<StickySectionNav items={baseItems} scrollBehavior="auto" />);

    fireEvent.click(screen.getByRole("button", { name: "Section 3" }));
    expect(scrollToMock).toHaveBeenCalledWith({ top: 388, behavior: "auto" });
  });

  it("scrolls provided container when ref is set", () => {
    const container = document.createElement("div");
    container.scrollTop = 10;
    container.getBoundingClientRect = () =>
      ({
        top: 100,
        bottom: 500,
        left: 0,
        right: 0,
        height: 400,
        width: 0,
        x: 0,
        y: 100,
        toJSON: () => ({}),
      }) as DOMRect;
    container.scrollTo = jest.fn();

    const target = document.createElement("div");
    target.id = "section-2";
    target.getBoundingClientRect = () =>
      ({
        top: 320,
        bottom: 360,
        left: 0,
        right: 0,
        height: 40,
        width: 0,
        x: 0,
        y: 320,
        toJSON: () => ({}),
      }) as DOMRect;

    container.appendChild(target);
    document.body.appendChild(container);

    const scrollContainerRef =
      { current: container } as NonNullable<StickySectionNavProps["scrollContainerRef"]>;

    render(
      <StickySectionNav
        items={baseItems}
        scrollContainerRef={scrollContainerRef}
        scrollBehavior="auto"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Section 2" }));
    expect(container.scrollTo).toHaveBeenCalledWith({ top: 218, behavior: "auto" });
    expect(scrollToMock).not.toHaveBeenCalled();
  });

  it("prioritizes targets within the scroll container when duplicate ids exist", () => {
    const container = document.createElement("div");
    container.scrollTop = 0;
    container.getBoundingClientRect = () =>
      ({
        top: 0,
        bottom: 400,
        left: 0,
        right: 0,
        height: 400,
        width: 0,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;
    container.scrollTo = jest.fn();

    const targetInside = document.createElement("div");
    targetInside.id = "section-2";
    targetInside.getBoundingClientRect = () =>
      ({
        top: 200,
        bottom: 240,
        left: 0,
        right: 0,
        height: 40,
        width: 0,
        x: 0,
        y: 200,
        toJSON: () => ({}),
      }) as DOMRect;

    const targetOutside = document.createElement("div");
    targetOutside.id = "section-2";

    container.appendChild(targetInside);
    document.body.appendChild(container);
    document.body.appendChild(targetOutside);

    const scrollContainerRef =
      { current: container } as NonNullable<StickySectionNavProps["scrollContainerRef"]>;

    render(
      <StickySectionNav
        items={baseItems}
        scrollContainerRef={scrollContainerRef}
        scrollBehavior="auto"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Section 2" }));
    expect(container.scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollToMock).not.toHaveBeenCalled();
  });

  it("updates the active id when observed sections intersect", async () => {
    const onActiveChange = jest.fn();

    render(
      <StickySectionNav
        items={baseItems}
        onActiveChange={onActiveChange}
        observeIds={["section-1", "section-2", "section-3"]}
      />
    );

    expect(intersectionCallback).toBeTruthy();
    await act(async () => {
      intersectionCallback?.([
        {
          isIntersecting: true,
          intersectionRatio: 0.8,
          target: { id: "section-3" } as unknown as Element,
        } as IntersectionObserverEntry,
      ]);
    });

    expect(
      screen.getByRole("button", { name: "Section 3" })
    ).toHaveAttribute("aria-current", "page");
    expect(onActiveChange).toHaveBeenCalledWith("section-3");
  });
});
