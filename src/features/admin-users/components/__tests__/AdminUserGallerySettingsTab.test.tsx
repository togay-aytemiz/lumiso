import { fireEvent, render, screen, waitFor } from "@/utils/testUtils";
import i18n from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import { useI18nToast } from "@/lib/toastHelpers";
import { AdminUserGallerySettingsTab } from "../AdminUserGallerySettingsTab";

jest.mock("@/lib/toastHelpers", () => ({
  useI18nToast: jest.fn(),
}));

describe("AdminUserGallerySettingsTab", () => {
  const previousLanguage = i18n.language;
  const toastApi = {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
    info: jest.fn(),
  };

  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  afterAll(async () => {
    await i18n.changeLanguage(previousLanguage);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (useI18nToast as jest.Mock).mockReturnValue(toastApi);
  });

  it("converts GB input to bytes when saving", async () => {
    const builder = (supabase as unknown as { __createQueryBuilder: () => any }).__createQueryBuilder();
    (supabase.from as unknown as jest.Mock).mockReturnValue(builder);

    const onSaved = jest.fn();
    render(
      <AdminUserGallerySettingsTab
        organizationId="org-1"
        limitBytes={3 * 1024 ** 3}
        onSaved={onSaved}
      />
    );

    fireEvent.change(screen.getByLabelText(/allowed storage/i), {
      target: { value: "5" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(builder.update).toHaveBeenCalled());
    expect(supabase.from).toHaveBeenCalledWith("organizations");
    expect(builder.update).toHaveBeenCalledWith({
      gallery_storage_limit_bytes: 5 * 1024 ** 3,
    });
    expect(builder.eq).toHaveBeenCalledWith("id", "org-1");
    expect(toastApi.success).toHaveBeenCalledWith("Gallery storage limit updated.");
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it("shows a validation toast when input is empty", async () => {
    const builder = (supabase as unknown as { __createQueryBuilder: () => any }).__createQueryBuilder();
    (supabase.from as unknown as jest.Mock).mockReturnValue(builder);

    render(<AdminUserGallerySettingsTab organizationId="org-1" limitBytes={3 * 1024 ** 3} />);

    fireEvent.change(screen.getByLabelText(/allowed storage/i), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(toastApi.error).toHaveBeenCalled());
    expect(builder.update).not.toHaveBeenCalled();
  });
});

