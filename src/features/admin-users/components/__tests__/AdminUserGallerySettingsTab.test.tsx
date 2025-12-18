import { fireEvent, render, screen, waitFor, within } from "@/utils/testUtils";
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
  type QueryBuilderMock = {
    update: jest.Mock;
    eq: jest.Mock;
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
    const builder = (supabase as unknown as { __createQueryBuilder: () => unknown })
      .__createQueryBuilder() as QueryBuilderMock;
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

  it("converts MB input to bytes when saving", async () => {
    const builder = (supabase as unknown as { __createQueryBuilder: () => unknown })
      .__createQueryBuilder() as QueryBuilderMock;
    (supabase.from as unknown as jest.Mock).mockReturnValue(builder);

    render(<AdminUserGallerySettingsTab organizationId="org-1" limitBytes={3 * 1024 ** 3} />);

    fireEvent.click(screen.getByRole("button", { name: "MB" }));
    fireEvent.change(screen.getByLabelText(/allowed storage/i), {
      target: { value: "20" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(builder.update).toHaveBeenCalled());
    expect(builder.update).toHaveBeenCalledWith({
      gallery_storage_limit_bytes: 20 * 1024 ** 2,
    });
    expect(builder.eq).toHaveBeenCalledWith("id", "org-1");
  });

  it("shows a validation toast when input is empty", async () => {
    const builder = (supabase as unknown as { __createQueryBuilder: () => unknown })
      .__createQueryBuilder() as QueryBuilderMock;
    (supabase.from as unknown as jest.Mock).mockReturnValue(builder);

    render(<AdminUserGallerySettingsTab organizationId="org-1" limitBytes={3 * 1024 ** 3} />);

    fireEvent.change(screen.getByLabelText(/allowed storage/i), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(toastApi.error).toHaveBeenCalled());
    expect(builder.update).not.toHaveBeenCalled();
  });

  it("confirms and deletes gallery without typing (admin actions)", async () => {
    (supabase.rpc as unknown as jest.Mock).mockImplementation((fnName: string) => {
      if (fnName === "admin_list_galleries_with_storage") {
        return Promise.resolve({
          data: [
            {
              id: "gallery-1",
              title: "My Gallery",
              status: "draft",
              type: "proof",
              lead_name: "Client One",
              created_at: null,
              updated_at: null,
              gallery_bytes: 1024,
            },
          ],
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    (supabase.functions.invoke as unknown as jest.Mock).mockResolvedValue({
      data: { success: true },
      error: null,
    });

    render(<AdminUserGallerySettingsTab organizationId="org-1" limitBytes={3 * 1024 ** 3} />);

    expect(await screen.findByText("Client One")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Delete gallery" }));

    expect(await screen.findByRole("heading", { name: "Delete gallery" })).toBeInTheDocument();

    const dialog = await screen.findByRole("alertdialog");
    const confirmButton = within(dialog).getByRole("button", { name: "Delete gallery" });
    expect(confirmButton).toBeEnabled();
    expect(screen.queryByLabelText("Type the gallery name to delete")).not.toBeInTheDocument();

    fireEvent.click(confirmButton);

    await waitFor(() =>
      expect(supabase.functions.invoke).toHaveBeenCalledWith("admin-gallery-delete", {
        body: { gallery_id: "gallery-1", confirm_title: "My Gallery" },
      })
    );
    await waitFor(() => expect(toastApi.success).toHaveBeenCalledWith("Gallery deleted."));
  });

  it("opens preview in a new tab after granting access (admin actions)", async () => {
    (supabase.rpc as unknown as jest.Mock).mockImplementation((fnName: string) => {
      if (fnName === "admin_list_galleries_with_storage") {
        return Promise.resolve({
          data: [
            {
              id: "gallery-1",
              title: "My Gallery",
              status: "draft",
              type: "proof",
              lead_name: "Client One",
              created_at: null,
              updated_at: null,
              gallery_bytes: 1024,
            },
          ],
          error: null,
        });
      }
      if (fnName === "admin_grant_gallery_access") {
        return Promise.resolve({ data: null, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const previewWindow = {
      location: { href: "" },
      focus: jest.fn(),
      close: jest.fn(),
    } as unknown as Window;

    const openSpy = jest.spyOn(window, "open").mockReturnValue(previewWindow);

    render(<AdminUserGallerySettingsTab organizationId="org-1" limitBytes={3 * 1024 ** 3} />);

    expect(await screen.findByText("Client One")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Preview" }));

    await waitFor(() =>
      expect(supabase.rpc).toHaveBeenCalledWith("admin_grant_gallery_access", {
        gallery_uuid: "gallery-1",
      })
    );
    expect(openSpy).toHaveBeenCalledWith("about:blank", "_blank");
    await waitFor(() => expect(previewWindow.location.href).toBe("/galleries/gallery-1/preview"));
    expect(previewWindow.focus).toHaveBeenCalled();

    openSpy.mockRestore();
  });
});
