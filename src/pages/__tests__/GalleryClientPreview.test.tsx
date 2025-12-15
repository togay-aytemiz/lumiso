import { fireEvent, render, screen, waitFor, within } from "@/utils/testUtils";
import GalleryClientPreview from "../GalleryClientPreview";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useParams } from "react-router-dom";

jest.mock("react-router-dom", () => {
  const actual = jest.requireActual("react-router-dom");
  return {
    ...actual,
    useNavigate: jest.fn(),
    useParams: jest.fn(),
  };
});

const mockUseNavigate = useNavigate as unknown as jest.Mock;
const mockUseParams = useParams as unknown as jest.Mock;

const supabaseMock = supabase as unknown as {
  from: jest.Mock;
  storage: {
    from: jest.Mock;
  };
  __createQueryBuilder: (initial?: { data?: unknown; error?: unknown }) => {
    __setResponse: (result: { data?: unknown; error?: unknown }) => unknown;
  };
};

describe("GalleryClientPreview", () => {
  const mockNavigate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseNavigate.mockReturnValue(mockNavigate);
    mockUseParams.mockReturnValue({ id: "gallery-123" });
  });

  it("renders empty state when gallery has no photos", async () => {
    supabaseMock.from.mockImplementation((table: string) => {
      const builder = supabaseMock.__createQueryBuilder();
      if (table === "galleries") {
        return builder.__setResponse({
          data: { id: "gallery-123", title: "My Gallery", type: "proof", branding: {} },
          error: null,
        });
      }
      if (table === "gallery_sets") {
        return builder.__setResponse({
          data: [{ id: "set-1", name: "Highlights", description: null, order_index: 1 }],
          error: null,
        });
      }
      if (table === "gallery_assets") {
        return builder.__setResponse({ data: [], error: null });
      }
      return builder;
    });

    render(<GalleryClientPreview />);

    expect(await screen.findByRole("heading", { name: "My Gallery" })).toBeInTheDocument();
    expect(
      await screen.findByText(/no photos|fotoğraf yok/i)
    ).toBeInTheDocument();
  });

  it("renders watermark overlay when enabled", async () => {
    supabaseMock.from.mockImplementation((table: string) => {
      const builder = supabaseMock.__createQueryBuilder();
      if (table === "galleries") {
        return builder.__setResponse({
          data: {
            id: "gallery-123",
            title: "My Gallery",
            type: "proof",
            branding: {
              watermark: {
                enabled: true,
                type: "text",
                placement: "center",
                opacity: 60,
                scale: 100,
                text: "Studio",
                logoUrl: null,
              },
            },
          },
          error: null,
        });
      }
      if (table === "gallery_sets") {
        return builder.__setResponse({
          data: [{ id: "set-1", name: "Highlights", description: null, order_index: 1 }],
          error: null,
        });
      }
      if (table === "gallery_assets") {
        return builder.__setResponse({
          data: [
            {
              id: "asset-1",
              storage_path_web: "org/galleries/gallery-123/proof/asset-1.webp",
              status: "ready",
              metadata: { originalName: "a.jpg", setId: "set-1", starred: false },
              created_at: "2025-01-01T00:00:00Z",
            },
          ],
          error: null,
        });
      }
      return builder;
    });

    render(<GalleryClientPreview />);

    expect(await screen.findByRole("heading", { name: "My Gallery" })).toBeInTheDocument();
    expect(await screen.findByAltText("a.jpg")).toBeInTheDocument();
    expect(await screen.findByText("Studio")).toBeInTheDocument();
  });

  it("renders categorized sets and scrolls to a set section", async () => {
    supabaseMock.from.mockImplementation((table: string) => {
      const builder = supabaseMock.__createQueryBuilder();
      if (table === "galleries") {
        return builder.__setResponse({
          data: { id: "gallery-123", title: "My Gallery", type: "proof", branding: {} },
          error: null,
        });
      }
      if (table === "gallery_sets") {
        return builder.__setResponse({
          data: [
            { id: "set-1", name: "Highlights", description: null, order_index: 1 },
            { id: "set-2", name: "Test 2", description: null, order_index: 2 },
          ],
          error: null,
        });
      }
      if (table === "gallery_assets") {
        return builder.__setResponse({
          data: [
            {
              id: "asset-1",
              storage_path_web: "org/galleries/gallery-123/proof/asset-1.webp",
              status: "ready",
              metadata: { originalName: "a.jpg", setId: "set-1", starred: false },
              created_at: "2025-01-01T00:00:00Z",
            },
            {
              id: "asset-2",
              storage_path_web: "org/galleries/gallery-123/proof/asset-2.webp",
              status: "ready",
              metadata: { originalName: "b.jpg", setId: "set-2", starred: false },
              created_at: "2025-01-02T00:00:00Z",
            },
          ],
          error: null,
        });
      }
      if (table === "client_selections") {
        return builder.__setResponse({ data: [], error: null });
      }
      return builder;
    });

    render(<GalleryClientPreview />);

    expect(await screen.findByRole("heading", { name: "My Gallery" })).toBeInTheDocument();
    expect(screen.queryByText(/highlights\\s*\\(all\\)/i)).not.toBeInTheDocument();

    const test2Buttons = await screen.findAllByRole("button", { name: "Test 2" });
    fireEvent.click(test2Buttons[0]);

    await waitFor(() => {
      const scrollToMock = window.scrollTo as unknown as jest.Mock;
      expect(scrollToMock).toHaveBeenCalledWith(expect.objectContaining({ behavior: "smooth" }));
    });

    expect(await screen.findByAltText("b.jpg")).toBeInTheDocument();

    const favoritesFilter = await screen.findByRole("button", { name: /^(favorites|favoriler)$/i });
    fireEvent.click(favoritesFilter);

    expect(await screen.findAllByRole("button", { name: "Test 2" })).toHaveLength(test2Buttons.length);
  });

  it("allows selecting and favoriting photos in preview mode", async () => {
    supabaseMock.from.mockImplementation((table: string) => {
      const builder = supabaseMock.__createQueryBuilder();
      if (table === "galleries") {
        return builder.__setResponse({
          data: {
            id: "gallery-123",
            title: "My Gallery",
            type: "proof",
            branding: {
              selectionSettings: { enabled: true, allowFavorites: true },
              selectionTemplate: [{ part: "Cover", min: 1, max: 1, required: true }],
            },
          },
          error: null,
        });
      }
      if (table === "gallery_sets") {
        return builder.__setResponse({
          data: [{ id: "set-1", name: "Highlights", description: null, order_index: 1 }],
          error: null,
        });
      }
      if (table === "gallery_assets") {
        return builder.__setResponse({
          data: [
            {
              id: "asset-1",
              storage_path_web: "org/galleries/gallery-123/proof/asset-1.webp",
              status: "ready",
              metadata: { originalName: "a.jpg", setId: "set-1", starred: true },
              created_at: "2025-01-01T00:00:00Z",
            },
          ],
          error: null,
        });
      }
      return builder;
    });

    render(<GalleryClientPreview />);

    expect(await screen.findByRole("heading", { name: "My Gallery" })).toBeInTheDocument();

    const thumbnail = await screen.findByAltText("a.jpg");
    expect(thumbnail).toBeInTheDocument();

    const addButtons = await screen.findAllByRole("button", { name: /^(add|ekle)$/i });
    const addButton =
      addButtons.find((button) => /add|ekle/i.test(button.textContent ?? "")) ?? addButtons[0];
    fireEvent.click(addButton);

    const menuTitle = await screen.findByText(/add to lists|listelere ekle/i);
    const menuContainer = menuTitle.closest("div")?.parentElement;
    expect(menuContainer).toBeTruthy();
    const coverOption = within(menuContainer as HTMLElement).getByRole("button", { name: /cover/i });
    fireEvent.click(coverOption);

    expect(await screen.findByText(/^(selected|seçildi)$/i)).toBeInTheDocument();

    const favoriteButton = await screen.findByRole("button", { name: /add to favorites|favorilere ekle/i });
    fireEvent.click(favoriteButton);

    const favoritesFilter = await screen.findByRole("button", { name: /^(favorites|favoriler)$/i });
    fireEvent.click(favoritesFilter);

    await waitFor(() => {
      expect(screen.getByAltText("a.jpg")).toBeInTheDocument();
    });

    const closeButtons = await screen.findAllByRole("button", { name: /close|kapat/i });
    const closeButton =
      closeButtons.find((button) => /close|kapat/i.test(button.textContent ?? "")) ?? closeButtons[0];
    fireEvent.click(closeButton);
    expect(mockNavigate).toHaveBeenCalledWith("/galleries/gallery-123");
  });

  it("shows up to 2 selection chips and summarizes the rest", async () => {
    supabaseMock.from.mockImplementation((table: string) => {
      const builder = supabaseMock.__createQueryBuilder();
      if (table === "galleries") {
        return builder.__setResponse({
          data: {
            id: "gallery-123",
            title: "My Gallery",
            type: "proof",
            branding: {
              selectionSettings: { enabled: true, allowFavorites: true },
              selectionTemplate: [
                { part: "Large Print", min: 0, max: 10, required: false },
                { part: "Test", min: 0, max: 10, required: false },
                { part: "Album", min: 0, max: 10, required: false },
              ],
            },
          },
          error: null,
        });
      }
      if (table === "gallery_sets") {
        return builder.__setResponse({
          data: [{ id: "set-1", name: "Highlights", description: null, order_index: 1 }],
          error: null,
        });
      }
      if (table === "gallery_assets") {
        return builder.__setResponse({
          data: [
            {
              id: "asset-1",
              storage_path_web: "org/galleries/gallery-123/proof/asset-1.webp",
              status: "ready",
              metadata: { originalName: "a.jpg", setId: "set-1", starred: false },
              created_at: "2025-01-01T00:00:00Z",
            },
          ],
          error: null,
        });
      }
      return builder;
    });

    render(<GalleryClientPreview />);

    expect(await screen.findByRole("heading", { name: "My Gallery" })).toBeInTheDocument();

    const addButtons = await screen.findAllByRole("button", { name: /^(add|ekle)$/i });
    const addButton =
      addButtons.find((button) => /add|ekle/i.test(button.textContent ?? "")) ?? addButtons[0];
    fireEvent.click(addButton);

    const menuTitle = await screen.findByText(/add to lists|listelere ekle/i);
    const menuContainer = menuTitle.closest("div")?.parentElement;
    expect(menuContainer).toBeTruthy();

    fireEvent.click(within(menuContainer as HTMLElement).getByRole("button", { name: /large print/i }));
    fireEvent.click(within(menuContainer as HTMLElement).getByRole("button", { name: /^test/i }));
    fireEvent.click(within(menuContainer as HTMLElement).getByRole("button", { name: /album/i }));

    const chipsContainer = await screen.findByTestId("gallery-preview-selection-chips-asset-1");
    expect(within(chipsContainer).getByText("Large Print")).toBeInTheDocument();
    expect(within(chipsContainer).getByText("Test")).toBeInTheDocument();
    expect(within(chipsContainer).getByText("+1")).toBeInTheDocument();
    expect(within(chipsContainer).queryByText("Album")).not.toBeInTheDocument();
  });

  it("keeps persisted selections when rule title changes", async () => {
    supabaseMock.from.mockImplementation((table: string) => {
      const builder = supabaseMock.__createQueryBuilder();
      if (table === "galleries") {
        return builder.__setResponse({
          data: {
            id: "gallery-123",
            title: "My Gallery",
            type: "proof",
            branding: {
              selectionSettings: { enabled: true, allowFavorites: true },
              selectionTemplate: [{ part: "Kapak", min: 1, max: 1, required: true }],
            },
          },
          error: null,
        });
      }
      if (table === "gallery_sets") {
        return builder.__setResponse({
          data: [{ id: "set-1", name: "Highlights", description: null, order_index: 1 }],
          error: null,
        });
      }
      if (table === "gallery_assets") {
        return builder.__setResponse({
          data: [
            {
              id: "asset-1",
              storage_path_web: "org/galleries/gallery-123/proof/asset-1.webp",
              status: "ready",
              metadata: { originalName: "a.jpg", setId: "set-1", starred: false },
              created_at: "2025-01-01T00:00:00Z",
            },
          ],
          error: null,
        });
      }
      if (table === "client_selections") {
        return builder.__setResponse({
          data: [
            {
              id: "selection-1",
              asset_id: "asset-1",
              selection_part: "cover",
              client_id: null,
            },
          ],
          error: null,
        });
      }
      return builder;
    });

    render(<GalleryClientPreview />);

    expect(await screen.findByRole("heading", { name: "My Gallery" })).toBeInTheDocument();
    expect(await screen.findByAltText("a.jpg")).toBeInTheDocument();

    const chipsContainer = await screen.findByTestId("gallery-preview-selection-chips-asset-1");
    expect(within(chipsContainer).getByText("Kapak")).toBeInTheDocument();
  });

  it("renders hero badge and event date when available", async () => {
    supabaseMock.from.mockImplementation((table: string) => {
      const builder = supabaseMock.__createQueryBuilder();
      if (table === "galleries") {
        return builder.__setResponse({
          data: {
            id: "gallery-123",
            title: "My Gallery",
            type: "proof",
            branding: { eventDate: "2025-01-01" },
          },
          error: null,
        });
      }
      if (table === "gallery_sets") {
        return builder.__setResponse({
          data: [{ id: "set-1", name: "Highlights", description: null, order_index: 1 }],
          error: null,
        });
      }
      if (table === "gallery_assets") {
        return builder.__setResponse({ data: [], error: null });
      }
      return builder;
    });

    render(<GalleryClientPreview />);

    expect(await screen.findByRole("heading", { name: "My Gallery" })).toBeInTheDocument();

    const badge = await screen.findByTestId("gallery-client-preview-hero-badge");
    expect(within(badge).getByText(/selection stage|seçim aşaması/i)).toBeInTheDocument();
    expect(
      screen.getByText(/please complete your selections|seçimlerinizi tamamlamanız bekleniyor/i)
    ).toBeInTheDocument();

    const eventDate = await screen.findByTestId("gallery-client-preview-event-date");
    expect(eventDate).toHaveTextContent(/2025/);
  });

  it("renders delivery badge for final galleries", async () => {
    supabaseMock.from.mockImplementation((table: string) => {
      const builder = supabaseMock.__createQueryBuilder();
      if (table === "galleries") {
        return builder.__setResponse({
          data: {
            id: "gallery-123",
            title: "My Gallery",
            type: "final",
            branding: {},
          },
          error: null,
        });
      }
      if (table === "gallery_sets") {
        return builder.__setResponse({
          data: [{ id: "set-1", name: "Highlights", description: null, order_index: 1 }],
          error: null,
        });
      }
      if (table === "gallery_assets") {
        return builder.__setResponse({ data: [], error: null });
      }
      return builder;
    });

    render(<GalleryClientPreview />);

    expect(await screen.findByRole("heading", { name: "My Gallery" })).toBeInTheDocument();

    const badge = await screen.findByTestId("gallery-client-preview-hero-badge");
    expect(within(badge).getByText(/final collection|final koleksiyon/i)).toBeInTheDocument();
    expect(screen.getByText(/all your memories are ready|tüm anılarınız hazır/i)).toBeInTheDocument();
  });

  it("prefers coverAssetId for the hero cover image", async () => {
    supabaseMock.storage.from.mockImplementation(() => ({
      createSignedUrl: jest.fn().mockImplementation((path: string) => {
        const url = path.includes("asset-2")
          ? "https://example.com/asset-2"
          : "https://example.com/asset-1";
        return Promise.resolve({ data: { signedUrl: url }, error: null });
      }),
    }));

    supabaseMock.from.mockImplementation((table: string) => {
      const builder = supabaseMock.__createQueryBuilder();
      if (table === "galleries") {
        return builder.__setResponse({
          data: { id: "gallery-123", title: "My Gallery", type: "proof", branding: { coverAssetId: "asset-2" } },
          error: null,
        });
      }
      if (table === "gallery_sets") {
        return builder.__setResponse({
          data: [{ id: "set-1", name: "Highlights", description: null, order_index: 1 }],
          error: null,
        });
      }
      if (table === "gallery_assets") {
        return builder.__setResponse({
          data: [
            {
              id: "asset-1",
              storage_path_web: "org/galleries/gallery-123/proof/asset-1.webp",
              status: "ready",
              metadata: { originalName: "a.jpg", setId: "set-1", starred: false },
              created_at: "2025-01-01T00:00:00Z",
            },
            {
              id: "asset-2",
              storage_path_web: "org/galleries/gallery-123/proof/asset-2.webp",
              status: "ready",
              metadata: { originalName: "b.jpg", setId: "set-1", starred: false },
              created_at: "2025-01-02T00:00:00Z",
            },
          ],
          error: null,
        });
      }
      return builder;
    });

    render(<GalleryClientPreview />);

    expect(await screen.findByRole("heading", { name: "My Gallery" })).toBeInTheDocument();

    const coverImage = await screen.findByAltText(/cover photo|kapak fotoğrafı/i);
    expect(coverImage).toHaveAttribute("src", "https://example.com/asset-2");
  });

  it("cleans up missing assets when storage objects are gone", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const galleryAssetsBuilder = supabaseMock.__createQueryBuilder();

      supabaseMock.storage.from.mockImplementation(() => ({
        createSignedUrl: jest.fn().mockResolvedValue({
          data: null,
          error: { statusCode: 404, message: "Object not found" },
        }),
      }));

      supabaseMock.from.mockImplementation((table: string) => {
        if (table === "galleries") {
          return supabaseMock.__createQueryBuilder().__setResponse({
            data: { id: "gallery-123", title: "My Gallery", type: "proof", branding: {} },
            error: null,
          });
        }
        if (table === "gallery_sets") {
          return supabaseMock.__createQueryBuilder().__setResponse({
            data: [{ id: "set-1", name: "Highlights", description: null, order_index: 1 }],
            error: null,
          });
        }
        if (table === "gallery_assets") {
          return galleryAssetsBuilder.__setResponse({
            data: [
              {
                id: "asset-missing",
                storage_path_web: "org/galleries/gallery-123/proof/asset-missing.webp",
                status: "ready",
                metadata: { originalName: "missing.jpg", setId: "set-1", starred: false },
                created_at: "2025-01-01T00:00:00Z",
              },
            ],
            error: null,
          });
        }
        return supabaseMock.__createQueryBuilder();
      });

      render(<GalleryClientPreview />);

      expect(await screen.findByRole("heading", { name: "My Gallery" })).toBeInTheDocument();
      expect(await screen.findByText(/no photos|fotoğraf yok/i)).toBeInTheDocument();

      await waitFor(() => {
        expect(galleryAssetsBuilder.delete).toHaveBeenCalled();
      });
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("falls back to a placeholder when an image fails to load", async () => {
    supabaseMock.storage.from.mockImplementation(() => ({
      createSignedUrl: jest.fn().mockResolvedValue({ data: { signedUrl: "https://example.com/asset-1" }, error: null }),
    }));

    supabaseMock.from.mockImplementation((table: string) => {
      const builder = supabaseMock.__createQueryBuilder();
      if (table === "galleries") {
        return builder.__setResponse({
          data: { id: "gallery-123", title: "My Gallery", type: "proof", branding: {} },
          error: null,
        });
      }
      if (table === "gallery_sets") {
        return builder.__setResponse({
          data: [{ id: "set-1", name: "Highlights", description: null, order_index: 1 }],
          error: null,
        });
      }
      if (table === "gallery_assets") {
        return builder.__setResponse({
          data: [
            {
              id: "asset-1",
              storage_path_web: "org/galleries/gallery-123/proof/asset-1.webp",
              status: "ready",
              metadata: { originalName: "a.jpg", setId: "set-1", starred: false },
              created_at: "2025-01-01T00:00:00Z",
            },
          ],
          error: null,
        });
      }
      if (table === "client_selections") {
        return builder.__setResponse({ data: [], error: null });
      }
      return builder;
    });

    render(<GalleryClientPreview />);

    const thumbnail = await screen.findByAltText("a.jpg");
    fireEvent.error(thumbnail);

    await waitFor(() => {
      expect(screen.queryByAltText("a.jpg")).not.toBeInTheDocument();
    });
  });

  it("offers an unselected shortcut from mobile selections", async () => {
    const originalInnerWidth = window.innerWidth;
    window.innerWidth = 375;

    supabaseMock.storage.from.mockImplementation(() => ({
      createSignedUrl: jest.fn().mockImplementation((path: string) => {
        const url = path.includes("asset-2") ? "https://example.com/asset-2" : "https://example.com/asset-1";
        return Promise.resolve({ data: { signedUrl: url }, error: null });
      }),
    }));

    supabaseMock.from.mockImplementation((table: string) => {
      const builder = supabaseMock.__createQueryBuilder();
      if (table === "galleries") {
        return builder.__setResponse({
          data: {
            id: "gallery-123",
            title: "My Gallery",
            type: "proof",
            branding: {
              selectionSettings: { enabled: true, allowFavorites: true },
              selectionTemplate: [{ part: "Cover", min: 1, max: 1, required: true }],
            },
          },
          error: null,
        });
      }
      if (table === "gallery_sets") {
        return builder.__setResponse({
          data: [{ id: "set-1", name: "Highlights", description: null, order_index: 1 }],
          error: null,
        });
      }
      if (table === "gallery_assets") {
        return builder.__setResponse({
          data: [
            {
              id: "asset-1",
              storage_path_web: "org/galleries/gallery-123/proof/asset-1.webp",
              status: "ready",
              metadata: { originalName: "a.jpg", setId: "set-1", starred: false },
              created_at: "2025-01-01T00:00:00Z",
            },
            {
              id: "asset-2",
              storage_path_web: "org/galleries/gallery-123/proof/asset-2.webp",
              status: "ready",
              metadata: { originalName: "b.jpg", setId: "set-1", starred: false },
              created_at: "2025-01-02T00:00:00Z",
            },
          ],
          error: null,
        });
      }
      if (table === "client_selections") {
        return builder.__setResponse({
          data: [{ id: "selection-1", asset_id: "asset-1", selection_part: "cover", client_id: "client-1" }],
          error: null,
        });
      }
      return builder;
    });

    try {
      render(<GalleryClientPreview />);

      expect(await screen.findByRole("heading", { name: "My Gallery" })).toBeInTheDocument();

      fireEvent.click(await screen.findByRole("button", { name: /selections|seçimlerim/i }));
      fireEvent.click(await screen.findByTestId("gallery-client-preview-unselected-shortcut"));

      await waitFor(() => {
        expect(screen.queryByAltText("a.jpg")).not.toBeInTheDocument();
      });
      expect(await screen.findByAltText("b.jpg")).toBeInTheDocument();
    } finally {
      window.innerWidth = originalInnerWidth;
    }
  });

  it("shows a mobile bottom nav with a selections tab", async () => {
    const originalInnerWidth = window.innerWidth;
    window.innerWidth = 375;

    supabaseMock.from.mockImplementation((table: string) => {
      const builder = supabaseMock.__createQueryBuilder();
      if (table === "galleries") {
        return builder.__setResponse({
          data: {
            id: "gallery-123",
            title: "My Gallery",
            type: "proof",
            branding: {
              selectionSettings: { enabled: true, allowFavorites: true },
              selectionTemplate: [{ part: "Cover", min: 1, max: 1, required: true }],
            },
          },
          error: null,
        });
      }
      if (table === "gallery_sets") {
        return builder.__setResponse({
          data: [{ id: "set-1", name: "Highlights", description: null, order_index: 1 }],
          error: null,
        });
      }
      if (table === "gallery_assets") {
        return builder.__setResponse({ data: [], error: null });
      }
      if (table === "client_selections") {
        return builder.__setResponse({ data: [], error: null });
      }
      return builder;
    });

    try {
      render(<GalleryClientPreview />);

      expect(await screen.findByRole("heading", { name: "My Gallery" })).toBeInTheDocument();

      const selectionsTab = await screen.findByRole("button", { name: /selections|seçimlerim/i });
      fireEvent.click(selectionsTab);

      expect(await screen.findByTitle(/selections|seçimlerim/i)).toBeInTheDocument();
      expect(
        await screen.findByText(
          /tap a task to view your selections|seçimlerinizi görüntülemek için ilgili göreve dokunun/i
        )
      ).toBeInTheDocument();
      expect(await screen.findByRole("button", { name: /cover/i })).toBeInTheDocument();
    } finally {
      window.innerWidth = originalInnerWidth;
    }
  });
});
