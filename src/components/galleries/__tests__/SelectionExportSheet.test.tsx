import { fireEvent, render, screen, waitFor } from "@/utils/testUtils";
import i18n from "@/i18n";
import { SelectionExportSheet } from "../SelectionExportSheet";

describe("SelectionExportSheet", () => {
  const previousLanguage = i18n.language;
  let originalClipboard: typeof navigator.clipboard;
  const originalPlatform = navigator.platform;

  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  afterAll(async () => {
    await i18n.changeLanguage(previousLanguage);
    Object.defineProperty(navigator, "platform", { value: originalPlatform, configurable: true });
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

  it("detects Windows and copies the master query excluding favorites-only photos", async () => {
    Object.defineProperty(navigator, "platform", { value: "Win32", configurable: true });

    render(
      <SelectionExportSheet
        open
        onOpenChange={jest.fn()}
        photos={[
          { id: "p1", filename: "IMG_0001.jpg", selections: ["rule1"], isFavorite: false },
          { id: "p2", filename: "IMG_0002.jpg", selections: [], isFavorite: true },
          { id: "p3", filename: "IMG_0003.jpg", selections: ["rule2"], isFavorite: true },
        ]}
        rules={[
          { id: "rule1", title: "Album Photos" },
          { id: "rule2", title: "Cover" },
        ]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Copy query" }));

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        "name:(IMG_0001.jpg OR IMG_0003.jpg)"
      );
    });
  });

  it("detects macOS and selects the Mac tab", async () => {
    Object.defineProperty(navigator, "platform", { value: "MacIntel", configurable: true });

    render(
      <SelectionExportSheet
        open
        onOpenChange={jest.fn()}
        photos={[{ id: "p1", filename: "IMG_0001.jpg", selections: ["rule1"], isFavorite: false }]}
        rules={[{ id: "rule1", title: "Album Photos" }]}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Mac" })).toHaveAttribute("aria-pressed", "true");
    });
  });

  it("shows the query when expanding a category", async () => {
    Object.defineProperty(navigator, "platform", { value: "Win32", configurable: true });

    render(
      <SelectionExportSheet
        open
        onOpenChange={jest.fn()}
        photos={[
          { id: "p1", filename: "IMG_0001.jpg", selections: ["rule1"], isFavorite: false },
        ]}
        rules={[{ id: "rule1", title: "Album Photos" }]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Album Photos/i }));

    expect(screen.getByText("Windows Explorer query")).toBeInTheDocument();
    expect(screen.getByText("name:(IMG_0001.jpg)")).toBeInTheDocument();
  });
});
