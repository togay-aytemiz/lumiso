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
  auth: {
    getUser: jest.Mock;
    getSession: jest.Mock;
  };
  storage: {
    from: jest.Mock;
  };
  functions: {
    invoke: jest.Mock;
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
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: "client-1" } }, error: null });
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

  it("renders footer branding and keeps it above overlays", async () => {
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

    render(
      <GalleryClientPreview
        branding={{ logoUrl: "https://example.com/logo.png", businessName: "Studio ABC" }}
      />
    );

    expect(await screen.findByRole("heading", { name: "My Gallery" })).toBeInTheDocument();

    const footer = screen.getByRole("contentinfo");
    expect(footer).toHaveClass("pb-[calc(env(safe-area-inset-bottom,0px)+96px)]");
    expect(screen.getByText("Studio ABC")).toBeInTheDocument();
    expect(screen.getByAltText("")).toHaveAttribute("src", "https://example.com/logo.png");
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
    const thumbnail = await screen.findByAltText("a.jpg");
    expect(thumbnail).toBeInTheDocument();
    expect(thumbnail).toHaveAttribute("width");
    expect(thumbnail).toHaveAttribute("height");
    const grid = await screen.findByTestId("gallery-client-preview-photo-grid");
    expect(grid).toHaveClass("grid");
    expect(grid.className).not.toMatch(/columns-/);
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

    const favoriteButtons = await screen.findAllByRole("button", { name: /add to favorites|favorilere ekle/i });
    fireEvent.click(favoriteButtons[0]);

    const favoritesFilter = await screen.findByRole("button", { name: /favori$/i });
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

    const chipsContainer = await screen.findByTestId("gallery-preview-selection-chips-asset-1");
    expect(within(chipsContainer).getByText("Cover")).toBeInTheDocument();

    const favoriteButton = await screen.findByRole("button", { name: /add to favorites|favorilere ekle/i });
    fireEvent.click(favoriteButton);

    const favoritesFilter = await screen.findByRole("button", { name: /favori$/i });
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
    fireEvent.click(within(menuContainer as HTMLElement).getByRole("button", { name: /test/i }));
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
              client_id: "client-1",
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

  it("does not show all/favorites toggles for final galleries when there are no favorites", async () => {
    supabaseMock.from.mockImplementation((table: string) => {
      const builder = supabaseMock.__createQueryBuilder();
      if (table === "galleries") {
        return builder.__setResponse({
          data: {
            id: "gallery-123",
            title: "My Gallery",
            type: "final",
            branding: { selectionSettings: { allowFavorites: true } },
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
        return builder.__setResponse({ data: [], error: null });
      }
      return builder;
    });

    render(<GalleryClientPreview />);

    expect(await screen.findByRole("heading", { name: "My Gallery" })).toBeInTheDocument();
    const allToggles = screen
      .queryAllByRole("button", { name: /^(all|tümü)$/i })
      .filter((button) => button.getAttribute("data-touch-target") === "compact");
    expect(allToggles).toHaveLength(0);

    const favoritesToggles = screen
      .queryAllByRole("button", { name: /favorites|favoriler/i })
      .filter((button) => button.getAttribute("data-touch-target") === "compact");
    expect(favoritesToggles).toHaveLength(0);
  });

  it("defaults to all and shows toggles for final galleries when favorites exist", async () => {
    supabaseMock.from.mockImplementation((table: string) => {
      const builder = supabaseMock.__createQueryBuilder();
      if (table === "galleries") {
        return builder.__setResponse({
          data: {
            id: "gallery-123",
            title: "My Gallery",
            type: "final",
            branding: { selectionSettings: { allowFavorites: true } },
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
              selection_part: "favorites",
              client_id: "client-1",
            },
          ],
          error: null,
        });
      }
      return builder;
    });

    render(<GalleryClientPreview />);

    expect(await screen.findByRole("heading", { name: "My Gallery" })).toBeInTheDocument();

    const allButton = await waitFor(() => {
      const candidates = screen.getAllByRole("button", { name: /^(all|tümü)$/i });
      const toggle = candidates.find((button) => button.getAttribute("data-touch-target") === "compact");
      if (!toggle) {
        throw new Error("Missing all toggle");
      }
      return toggle;
    });
    expect(allButton).toHaveAttribute("aria-current", "page");

    const favoritesButton = await waitFor(() => {
      const candidates = screen.getAllByRole("button", { name: /favorites|favoriler/i });
      const toggle = candidates.find((button) => button.getAttribute("data-touch-target") === "compact");
      if (!toggle) {
        throw new Error("Missing favorites toggle");
      }
      return toggle;
    });
    expect(favoritesButton).not.toHaveAttribute("aria-current", "page");
  });

  it("hides mobile bottom nav for final galleries when there are no favorites", async () => {
    const originalWidth = window.innerWidth;
    window.innerWidth = 375;

    supabaseMock.from.mockImplementation((table: string) => {
      const builder = supabaseMock.__createQueryBuilder();
      if (table === "galleries") {
        return builder.__setResponse({
          data: {
            id: "gallery-123",
            title: "My Gallery",
            type: "final",
            branding: { selectionSettings: { allowFavorites: true } },
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
        return builder.__setResponse({ data: [], error: null });
      }
      return builder;
    });

    render(<GalleryClientPreview />);

    expect(await screen.findByRole("heading", { name: "My Gallery" })).toBeInTheDocument();
    expect(screen.queryByLabelText(/gallery navigation|galeri sekmeleri/i)).not.toBeInTheDocument();

    window.innerWidth = originalWidth;
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

      fireEvent.click(await screen.findByRole("button", { name: /clear|temizle/i }));
      expect(await screen.findByAltText("a.jpg")).toBeInTheDocument();
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

  it("hides the mobile recommended tab when there are no starred photos", async () => {
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

    try {
      render(<GalleryClientPreview />);

      expect(await screen.findByRole("heading", { name: "My Gallery" })).toBeInTheDocument();

      const bottomNav = await screen.findByRole("navigation", { name: /gallery navigation|galeri sekmeleri/i });
      expect(within(bottomNav).queryByRole("button", { name: /recommended|önerilen/i })).not.toBeInTheDocument();
      expect(within(bottomNav).getAllByRole("button")).toHaveLength(3);
    } finally {
      window.innerWidth = originalInnerWidth;
    }
  });

  it("shows the mobile recommended tab when there are starred photos", async () => {
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
      if (table === "client_selections") {
        return builder.__setResponse({ data: [], error: null });
      }
      return builder;
    });

    try {
      render(<GalleryClientPreview />);

      expect(await screen.findByRole("heading", { name: "My Gallery" })).toBeInTheDocument();

      const bottomNav = await screen.findByRole("navigation", { name: /gallery navigation|galeri sekmeleri/i });
      expect(await within(bottomNav).findByRole("button", { name: /recommended|önerilen/i })).toBeInTheDocument();
      expect(within(bottomNav).getAllByRole("button")).toHaveLength(4);
    } finally {
      window.innerWidth = originalInnerWidth;
    }
  });

  it("prefills the note with the latest saved note after the photographer reopens selections", async () => {
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
              width: 1200,
              height: 800,
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
          data: [{ id: "selection-1", asset_id: "asset-1", selection_part: "cover", client_id: "client-1" }],
          error: null,
        });
      }
      if (table === "gallery_selection_states") {
        return builder.__setResponse({
          data: {
            gallery_id: "gallery-123",
            is_locked: false,
            note: "Keep this one",
            locked_at: "2025-01-01T00:00:00Z",
            unlocked_at: "2025-01-02T00:00:00Z",
          },
          error: null,
        });
      }
      return builder;
    });

    render(<GalleryClientPreview />);

    expect(await screen.findByRole("heading", { name: "My Gallery" })).toBeInTheDocument();

    const resendButton = await screen.findByRole("button", { name: /resend selections|seçimleri tekrar gönder/i });

    await waitFor(() => {
      expect(resendButton).not.toBeDisabled();
    });

    fireEvent.click(resendButton);

    const dialog = await screen.findByRole("dialog");
    const textarea = within(dialog).getByRole("textbox");

    await waitFor(() => {
      expect(textarea).toHaveValue("Keep this one");
    });
  });

  it("opens bulk download modal and starts download", async () => {
    const clickSpy = jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    supabaseMock.auth.getSession.mockResolvedValue({
      data: { session: { access_token: "token-123" } },
      error: null,
    });

    supabaseMock.from.mockImplementation((table: string) => {
      const builder = supabaseMock.__createQueryBuilder();
      if (table === "galleries") {
        return builder.__setResponse({
          data: { id: "gallery-123", title: "My Gallery", type: "proof", branding: {} },
          error: null,
        });
      }
      if (table === "gallery_sets") {
        return builder.__setResponse({ data: [], error: null });
      }
      if (table === "gallery_assets") {
        return builder.__setResponse({
          data: [
            {
              id: "asset-1",
              storage_path_web: "org/gallery/asset.jpg",
              storage_path_original: null,
              status: "ready",
              metadata: { originalName: "asset.jpg" },
              created_at: "2024-01-01T00:00:00Z",
              width: 1200,
              height: 800,
            },
          ],
          error: null,
        });
      }
      if (table === "gallery_selection_states") {
        return builder.__setResponse({ data: null, error: null });
      }
      if (table === "client_selections") {
        return builder.__setResponse({ data: [], error: null });
      }
      return builder;
    });

    try {
      render(<GalleryClientPreview />);

      const downloadButton = await screen.findByRole("button", { name: /download all|hepsini indir/i });
      await waitFor(() => {
        expect(downloadButton).not.toBeDisabled();
      });
      fireEvent.click(downloadButton);

      const dialog = await screen.findByRole("dialog");
      const confirmButton = within(dialog).getByRole("button", { name: /prepare download|indirmeyi hazirla/i });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(supabaseMock.auth.getSession).toHaveBeenCalled();
        expect(clickSpy).toHaveBeenCalled();
      });
    } finally {
      clickSpy.mockRestore();
    }
  });
});
