import { fireEvent, render, screen, waitFor } from "@/utils/testUtils";
import i18n from "@/i18n";
import { GalleryShareSheet } from "../GalleryShareSheet";

describe("GalleryShareSheet", () => {
  const previousLanguage = i18n.language;
  let originalClipboard: typeof navigator.clipboard;

  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  afterAll(async () => {
    await i18n.changeLanguage(previousLanguage);
  });

  beforeEach(() => {
    originalClipboard = navigator.clipboard;
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn().mockResolvedValue(undefined),
      },
    });
  });

  afterEach(() => {
    Object.assign(navigator, { clipboard: originalClipboard });
  });

  it("renders the public link and copies it", async () => {
    render(
      <GalleryShareSheet
        open
        onOpenChange={jest.fn()}
        title="My gallery"
        clientName="Ayse"
        publicId="PUB123"
        pin="4T0PXF"
      />
    );

    const expectedUrl = new URL("/g/PUB123", window.location.origin).toString();
    expect(screen.getByText(expectedUrl)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Copy" }));

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expectedUrl);
    });
  });

  it("disables copy while the link is generating", () => {
    render(
      <GalleryShareSheet
        open
        onOpenChange={jest.fn()}
        title="My gallery"
        clientName="Ayse"
        publicId={null}
        pin="4T0PXF"
        generatingPublicId
      />
    );

    expect(screen.getByRole("button", { name: "Copy" })).toBeDisabled();
    expect(screen.getByText("Generating link…")).toBeInTheDocument();
  });

  it("opens WhatsApp with the default message", async () => {
    const openSpy = jest
      .spyOn(window, "open")
      .mockImplementation(() => ({ focus: jest.fn() }) as unknown as Window);
    const onShare = jest.fn();

    render(
      <GalleryShareSheet
        open
        onOpenChange={jest.fn()}
        onShare={onShare}
        title="My gallery"
        clientName="Ayse"
        publicId="PUB123"
        pin="4T0PXF"
      />
    );

    const expectedUrl = new URL("/g/PUB123", window.location.origin).toString();

    fireEvent.click(screen.getByRole("button", { name: "WhatsApp" }));

    expect(onShare).toHaveBeenCalledWith("whatsapp");

    await waitFor(() => {
      expect(openSpy).toHaveBeenCalled();
    });

    const openedUrl = String(openSpy.mock.calls[0]?.[0] ?? "");
    const parsed = new URL(openedUrl);
    const textParam = parsed.searchParams.get("text") ?? "";
    const normalizedText = textParam.replace(/\r\n/g, "\n");

    expect(normalizedText).toContain(`👉 Your gallery: ${expectedUrl}\n\n🔒 Access password: 4T0PXF`);
    expect(normalizedText).not.toContain("\\n");

    openSpy.mockRestore();
  });
});
