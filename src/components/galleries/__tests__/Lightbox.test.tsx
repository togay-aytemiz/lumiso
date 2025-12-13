import { fireEvent, render, screen } from "@/utils/testUtils";
import { Lightbox } from "../Lightbox";

describe("Lightbox", () => {
  it("handles keyboard shortcuts in client mode", () => {
    const onClose = jest.fn();
    const onNavigate = jest.fn();
    const onToggleRule = jest.fn();
    const onToggleStar = jest.fn();

    render(
      <Lightbox
        isOpen
        onClose={onClose}
        photos={[
          {
            id: "photo-1",
            url: "https://example.com/1.jpg",
            filename: "1.jpg",
            isFavorite: false,
            isStarred: false,
            selections: [],
          },
          {
            id: "photo-2",
            url: "https://example.com/2.jpg",
            filename: "2.jpg",
            isFavorite: false,
            isStarred: false,
            selections: [],
          },
        ]}
        currentIndex={0}
        onNavigate={onNavigate}
        rules={[
          {
            id: "rule-1",
            title: "Cover",
            serviceName: null,
            currentCount: 0,
            maxCount: 1,
          },
        ]}
        onToggleRule={onToggleRule}
        onToggleStar={onToggleStar}
        mode="client"
        activeRuleId="rule-1"
      />
    );

    expect(screen.getByText("1.jpg")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(onNavigate).toHaveBeenCalledWith(1);

    fireEvent.keyDown(window, { key: "f" });
    expect(onToggleStar).toHaveBeenCalledWith("photo-1");

    fireEvent.keyDown(window, { key: " ", code: "Space" });
    expect(onToggleRule).toHaveBeenCalledWith("photo-1", "rule-1");

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("does not toggle active rule when it is full", () => {
    const onToggleRule = jest.fn();

    render(
      <Lightbox
        isOpen
        onClose={jest.fn()}
        photos={[
          {
            id: "photo-1",
            url: "https://example.com/1.jpg",
            filename: "1.jpg",
            isFavorite: false,
            isStarred: false,
            selections: [],
          },
        ]}
        currentIndex={0}
        onNavigate={jest.fn()}
        rules={[
          {
            id: "rule-1",
            title: "Cover",
            serviceName: null,
            currentCount: 1,
            maxCount: 1,
          },
        ]}
        onToggleRule={onToggleRule}
        onToggleStar={jest.fn()}
        mode="client"
        activeRuleId="rule-1"
      />
    );

    fireEvent.keyDown(window, { key: " ", code: "Space" });
    expect(onToggleRule).not.toHaveBeenCalled();
  });
});

