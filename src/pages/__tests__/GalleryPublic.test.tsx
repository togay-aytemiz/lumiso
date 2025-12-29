import { render, screen, waitFor } from "@/utils/testUtils";
import GalleryPublic from "../GalleryPublic";
import { supabase } from "@/integrations/supabase/client";
import { useParams } from "react-router-dom";

jest.mock("@/pages/GalleryClientPreview", () => ({
  __esModule: true,
  default: ({
    galleryId,
    branding,
  }: {
    galleryId?: string;
    branding?: { logoUrl?: string | null; businessName?: string | null } | null;
  }) => (
    <div data-testid="mock-gallery-client-preview">
      <div data-testid="mock-gallery-id">{galleryId ?? ""}</div>
      <div data-testid="mock-business-name">{branding?.businessName ?? ""}</div>
      <div data-testid="mock-logo-url">{branding?.logoUrl ?? ""}</div>
    </div>
  ),
}));

const mockUseParams = useParams as unknown as jest.Mock;

const supabaseMock = supabase as unknown as {
  auth: {
    getSession: jest.Mock;
    signInAnonymously: jest.Mock;
  };
  functions: {
    invoke: jest.Mock;
  };
};

describe("GalleryPublic", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
    document.title = "";
    mockUseParams.mockReturnValue({ publicId: "pub-ok" });
    supabaseMock.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    supabaseMock.auth.signInAnonymously.mockResolvedValue({ data: { user: { id: "anon-user" } }, error: null });
  });

  it("passes organization branding to client view when access is cached", async () => {
    sessionStorage.setItem("gallery-access:PUB-OK", "gallery-123");
    supabaseMock.functions.invoke.mockImplementation((name: string) => {
      if (name === "gallery-branding") {
        return Promise.resolve({
          data: { logoUrl: "https://example.com/logo.png", businessName: "Studio ABC" },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    render(<GalleryPublic />);

    expect(await screen.findByTestId("mock-gallery-client-preview")).toBeInTheDocument();
    expect(screen.getByTestId("mock-gallery-id")).toHaveTextContent("gallery-123");

    await waitFor(() => {
      expect(supabaseMock.functions.invoke).toHaveBeenCalledWith("gallery-branding", {
        body: { publicId: "PUB-OK" },
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId("mock-business-name")).toHaveTextContent("Studio ABC");
      expect(screen.getByTestId("mock-logo-url")).toHaveTextContent("https://example.com/logo.png");
    });
  });

  it("renders organization logo + business name footer", async () => {
    supabaseMock.functions.invoke.mockImplementation((name: string) => {
      if (name === "gallery-branding") {
        return Promise.resolve({
          data: { logoUrl: "https://example.com/logo.png", businessName: "Studio ABC" },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    render(<GalleryPublic />);

    await waitFor(() => {
      expect(supabaseMock.functions.invoke).toHaveBeenCalledWith("gallery-branding", {
        body: { publicId: "PUB-OK" },
      });
    });

    expect(await screen.findByText("Studio ABC")).toBeInTheDocument();
    expect(screen.getByAltText("")).toHaveAttribute("src", "https://example.com/logo.png");
  });

  it("renders business name only when logo missing", async () => {
    supabaseMock.functions.invoke.mockImplementation((name: string) => {
      if (name === "gallery-branding") {
        return Promise.resolve({
          data: { logoUrl: null, businessName: "Studio ABC" },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    render(<GalleryPublic />);

    expect(await screen.findByText("Studio ABC")).toBeInTheDocument();
    expect(screen.queryByAltText("")).not.toBeInTheDocument();
  });

  it("renders logo with localized alt when business name missing", async () => {
    supabaseMock.functions.invoke.mockImplementation((name: string) => {
      if (name === "gallery-branding") {
        return Promise.resolve({
          data: { logoUrl: "https://example.com/logo.png", businessName: null },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    render(<GalleryPublic />);

    const logo = await screen.findByAltText(/business logo|işletme logosu/i);
    expect(logo).toHaveAttribute("src", "https://example.com/logo.png");
    expect(screen.queryByText("Studio ABC")).not.toBeInTheDocument();
  });

  it("sets document title to gallery + business name", async () => {
    supabaseMock.functions.invoke.mockImplementation((name: string) => {
      if (name === "gallery-branding") {
        return Promise.resolve({
          data: { galleryTitle: "Eda & Mert", businessName: "Sweet Dreams Photographys", logoUrl: null },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    render(<GalleryPublic />);

    await waitFor(() => {
      expect(document.title).toBe("Eda & Mert | Sweet Dreams Photographys");
    });
  });
});
