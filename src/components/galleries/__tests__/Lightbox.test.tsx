import { fireEvent, render, screen, waitFor } from "@/utils/testUtils";
import { Lightbox } from "../Lightbox";

describe("Lightbox", () => {
  it("renders a close button", () => {
    const onClose = jest.fn();

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
        ]}
        currentIndex={0}
        onNavigate={jest.fn()}
        rules={[]}
        onToggleRule={jest.fn()}
        onToggleStar={jest.fn()}
      />
    );

    fireEvent.click(screen.getAllByRole("button", { name: /close|kapat/i })[0]);
    expect(onClose).toHaveBeenCalled();
  });

  it("allows collapsing and reopening sidebar in admin mode", () => {
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
            currentCount: 0,
            maxCount: 1,
          },
        ]}
        onToggleRule={jest.fn()}
        onToggleStar={jest.fn()}
        mode="admin"
      />
    );

    expect(screen.getByText(/selection details|seçim detayları/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /collapse|daralt/i }));
    expect(screen.queryByText(/selection details|seçim detayları/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /selections|seçimler/i }));
    expect(screen.getByText(/selection details|seçim detayları/i)).toBeInTheDocument();
  });

  it("shows selection sidebar in client mode when there are rules", () => {
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
            currentCount: 0,
            maxCount: 1,
          },
        ]}
        onToggleRule={jest.fn()}
        onToggleStar={jest.fn()}
        mode="client"
      />
    );

    expect(screen.getByText(/add to lists|listelere ekle/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /download|indir/i })).not.toBeInTheDocument();
  });

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

    expect(screen.getAllByText("1.jpg")[0]).toBeInTheDocument();

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

  it("does not allow toggling when selections are locked", () => {
    const onToggleRule = jest.fn();
    const onToggleStar = jest.fn();

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
            currentCount: 0,
            maxCount: 1,
          },
        ]}
        onToggleRule={onToggleRule}
        onToggleStar={onToggleStar}
        mode="client"
        activeRuleId="rule-1"
        isSelectionsLocked
      />
    );

    fireEvent.keyDown(window, { key: "f" });
    fireEvent.keyDown(window, { key: " ", code: "Space" });

    expect(onToggleStar).not.toHaveBeenCalled();
    expect(onToggleRule).not.toHaveBeenCalled();
  });

  it("navigates with swipe gestures", () => {
    const onNavigate = jest.fn();

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
        rules={[]}
        onToggleRule={jest.fn()}
        onToggleStar={jest.fn()}
        mode="client"
      />
    );

    const image = screen.getAllByAltText("1.jpg")[0];

    fireEvent.touchStart(image, {
      targetTouches: [{ clientX: 100, clientY: 0 }],
    });
    fireEvent.touchMove(image, {
      targetTouches: [{ clientX: 0, clientY: 0 }],
    });
    fireEvent.touchEnd(image);

    expect(onNavigate).toHaveBeenCalledWith(1);
  });

  it("shows mobile navigation arrows", () => {
    const onNavigate = jest.fn();

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
        rules={[]}
        onToggleRule={jest.fn()}
        onToggleStar={jest.fn()}
        mode="client"
      />
    );

    fireEvent.click(screen.getByTestId("lightbox-mobile-next"));
    expect(onNavigate).toHaveBeenCalledWith(1);
  });

  it("hides selection lists in client mode when there are no rules", () => {
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
        rules={[]}
        onToggleRule={jest.fn()}
        onToggleStar={jest.fn()}
        mode="client"
      />
    );

    expect(screen.queryByText(/add to lists|listelere ekle/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /download|indir/i })).toBeInTheDocument();
  });

  it("shows download button in client mode and downloads preview url", () => {
    const appendChildSpy = jest.spyOn(document.body, "appendChild");
    const clickSpy = jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

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
        rules={[]}
        onToggleRule={jest.fn()}
        onToggleStar={jest.fn()}
        mode="client"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /download|indir/i }));

    const anchorNode = appendChildSpy.mock.calls
      .map(([node]) => node)
      .find((node) => node instanceof HTMLAnchorElement) as HTMLAnchorElement | undefined;

    expect(anchorNode?.href).toContain("https://example.com/1.jpg");
    expect(anchorNode?.href).toContain("download=");
    expect(clickSpy).toHaveBeenCalled();

    appendChildSpy.mockRestore();
    clickSpy.mockRestore();
  });

  it("downloads original url when enableOriginalDownload is set", async () => {
    const appendChildSpy = jest.spyOn(document.body, "appendChild");
    const clickSpy = jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const resolveOriginalUrl = jest
      .fn()
      .mockResolvedValue("https://example.com/original.jpg?token=abc");

    render(
      <Lightbox
        isOpen
        onClose={jest.fn()}
        photos={[
          {
            id: "photo-1",
            url: "https://example.com/preview.webp?token=xyz",
            originalPath: "bucket/original/photo-1.jpg",
            filename: "photo-1.webp",
            isFavorite: false,
            isStarred: false,
            selections: [],
          },
        ]}
        currentIndex={0}
        onNavigate={jest.fn()}
        rules={[]}
        onToggleRule={jest.fn()}
        onToggleStar={jest.fn()}
        mode="client"
        enableOriginalDownload
        resolveOriginalUrl={resolveOriginalUrl}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /download|indir/i }));

    await waitFor(() => {
      expect(resolveOriginalUrl).toHaveBeenCalledWith(
        expect.objectContaining({ id: "photo-1" })
      );
    });

    const anchorNode = appendChildSpy.mock.calls
      .map(([node]) => node)
      .find((node) => node instanceof HTMLAnchorElement) as HTMLAnchorElement | undefined;

    expect(anchorNode?.href).toContain("https://example.com/original.jpg");
    expect(anchorNode?.href).toContain("download=");
    expect(clickSpy).toHaveBeenCalled();

    appendChildSpy.mockRestore();
    clickSpy.mockRestore();
  });

  it("does not show download button in admin mode", () => {
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
        rules={[]}
        onToggleRule={jest.fn()}
        onToggleStar={jest.fn()}
        mode="admin"
      />
    );

    expect(screen.queryByRole("button", { name: /download|indir/i })).not.toBeInTheDocument();
  });
});
