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
          data: { id: "gallery-123", title: "My Gallery", branding: {} },
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

  it("allows selecting and favoriting photos in preview mode", async () => {
    supabaseMock.from.mockImplementation((table: string) => {
      const builder = supabaseMock.__createQueryBuilder();
      if (table === "galleries") {
        return builder.__setResponse({
          data: {
            id: "gallery-123",
            title: "My Gallery",
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

    const addButton = await screen.findByRole("button", { name: /^(add|ekle)$/i });
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

    const closeButton = await screen.findByRole("button", { name: /close|kapat/i });
    fireEvent.click(closeButton);
    expect(mockNavigate).toHaveBeenCalledWith("/galleries/gallery-123");
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
          data: { id: "gallery-123", title: "My Gallery", branding: { coverAssetId: "asset-2" } },
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
            data: { id: "gallery-123", title: "My Gallery", branding: {} },
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
});
