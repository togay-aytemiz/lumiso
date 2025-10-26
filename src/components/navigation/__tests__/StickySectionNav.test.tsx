import { act, fireEvent, render, screen } from "@/utils/testUtils";
import { StickySectionNav, StickySectionNavProps } from "../StickySectionNav";

type IOCallback = (entries: IntersectionObserverEntry[]) => void;

const observeMock = jest.fn();
const disconnectMock = jest.fn();
let intersectionCallback: IOCallback | null = null;

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
    // @ts-expect-error - assign test double
    global.IntersectionObserver = FakeIntersectionObserver;
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

  it("scrolls to section when onSelect is absent", () => {
    const target = document.createElement("div");
    target.id = "section-3";
    const scrollSpy = jest.fn();
    target.scrollIntoView = scrollSpy;
    document.body.appendChild(target);

    render(<StickySectionNav items={baseItems} scrollBehavior="auto" />);

    fireEvent.click(screen.getByRole("button", { name: "Section 3" }));
    expect(scrollSpy).toHaveBeenCalledWith({ behavior: "auto", block: "start" });
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
