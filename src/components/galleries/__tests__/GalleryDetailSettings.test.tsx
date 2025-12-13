import { fireEvent, render, screen } from "@/utils/testUtils";
import i18n from "@/i18n";
import { SettingsProvider } from "@/contexts/SettingsContext";
import {
  GallerySettingsContent,
  GallerySettingsRail,
  type GallerySettingsTab,
} from "../GalleryDetailSettings";

describe("GalleryDetailSettings", () => {
  const previousLanguage = i18n.language;

  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  afterAll(async () => {
    await i18n.changeLanguage(previousLanguage);
  });

  it("renders rail items and changes active tab", () => {
    const onTabChange = jest.fn();
    render(<GallerySettingsRail activeTab="general" onTabChange={onTabChange} />);

    expect(screen.getByRole("button", { name: "General" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Watermark" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Privacy" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Watermark" }));
    expect(onTabChange).toHaveBeenCalledWith("watermark");
  });

  it.each([
    ["general", "General settings"],
    ["watermark", "Watermark settings"],
    ["privacy", "Privacy settings"],
  ] satisfies Array<[GallerySettingsTab, string]>)(
    "renders content header for %s",
    (activeTab, expectedTitle) => {
      render(
        <SettingsProvider>
          <GallerySettingsContent
            activeTab={activeTab}
            general={{
              title: "My gallery",
              onTitleChange: jest.fn(),
              eventDate: "2025-01-01",
              onEventDateChange: jest.fn(),
              status: "draft",
              onStatusChange: jest.fn(),
              statusOptions: [{ value: "draft", label: "Draft" }],
              type: "proof",
              onTypeChange: jest.fn(),
              typeOptions: [{ value: "proof", label: "Proof" }],
              customType: "",
              onCustomTypeChange: jest.fn(),
              autoSaveLabel: "Saved",
              disableTypeEditing: true,
            }}
            watermark={{
              settings: {
                enabled: false,
                type: "text",
                placement: "grid",
                opacity: 60,
                scale: 100,
              },
              onSettingsChange: jest.fn(),
              textDraft: "",
              onTextDraftChange: jest.fn(),
              businessName: "Studio",
              logoUrl: null,
              coverUrl: "",
              onOpenOrganizationBranding: jest.fn(),
            }}
            privacy={{
              settings: { passwordEnabled: false },
              onSettingsChange: jest.fn(),
              passwordDraft: "",
              onPasswordDraftChange: jest.fn(),
              onGeneratePassword: jest.fn(),
            }}
            saveBar={{
              show: false,
              isSaving: false,
              showSuccess: false,
              onSave: jest.fn(),
              onCancel: jest.fn(),
            }}
          />
        </SettingsProvider>
      );

      expect(screen.getByRole("heading", { name: expectedTitle })).toBeInTheDocument();
    }
  );
});
