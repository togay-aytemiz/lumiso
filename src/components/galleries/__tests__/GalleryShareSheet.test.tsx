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

    const expectedUrl = "http://localhost/g/PUB123";
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

  it("initializes the message with real line breaks", async () => {
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

    const messageBox = screen.getByRole("textbox");
    const expectedUrl = "http://localhost/g/PUB123";

    await waitFor(() => {
      const normalizedValue = (messageBox as HTMLTextAreaElement).value.replace(/\r\n/g, "\n");
      expect(normalizedValue).toContain(`👉 Your gallery: ${expectedUrl}\n\n🔒`);
    });

    expect((messageBox as HTMLTextAreaElement).value).not.toContain("\\n");
  });
});
