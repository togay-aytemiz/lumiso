import React from "react";
import { fireEvent, render, screen, waitFor } from "@/utils/testUtils";
import { ImageLibrarySheet } from "../ImageLibrarySheet";

const toastMock = jest.fn();
jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key}:${JSON.stringify(options)}` : key,
  }),
}));

jest.mock("@/hooks/useTypedTranslation", () => ({
  useMessagesTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => (options?.name ? `${key}:${options.name}` : key),
  }),
}));

jest.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: (...args: unknown[]) => toastMock(...args),
  }),
}));

const useOrganizationMock = jest.fn();
jest.mock("@/contexts/OrganizationContext", () => ({
  useOrganization: () => useOrganizationMock(),
}));

jest.mock("../CompactStorageIndicator", () => ({
  CompactStorageIndicator: () => <div data-testid="storage-indicator" />,
}));

jest.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  AlertDialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogCancel: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  AlertDialogAction: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));

const fromMock = jest.fn();
const storageFromMock = jest.fn();

jest.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
    storage: {
      from: (...args: unknown[]) => storageFromMock(...args),
    },
  },
}));

const clipboardWriteMock = jest.fn().mockResolvedValue(undefined);

let assetsList: Array<{
  id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  content_type: string;
  alt_text?: string;
  created_at: string;
}>;

let selectMock: jest.Mock;
let selectEqMock: jest.Mock;
let orderMock: jest.Mock;
let deleteMock: jest.Mock;
let deleteEqMock: jest.Mock;
let updateMock: jest.Mock;
let updateEqMock: jest.Mock;
let getPublicUrlMock: jest.Mock;
let removeMock: jest.Mock;

beforeAll(() => {
  Object.assign(navigator, {
    clipboard: {
      writeText: clipboardWriteMock,
    },
  });
});

beforeEach(() => {
  assetsList = [
    {
      id: "asset-1",
      file_name: "studio.jpg",
      file_path: "studio.jpg",
      file_size: 1024,
      content_type: "image/jpeg",
      alt_text: "Studio setup",
      created_at: "2024-05-01T00:00:00.000Z",
    },
  ];

  orderMock = jest.fn().mockResolvedValue({ data: assetsList, error: null });
  selectEqMock = jest.fn().mockReturnValue({ order: orderMock });
  selectMock = jest.fn().mockReturnValue({ eq: selectEqMock });

  deleteEqMock = jest.fn().mockResolvedValue({ error: null });
  deleteMock = jest.fn().mockReturnValue({ eq: deleteEqMock });

  updateEqMock = jest.fn().mockResolvedValue({ error: null });
  updateMock = jest.fn().mockReturnValue({ eq: updateEqMock });

  fromMock.mockImplementation((table: string) => {
    if (table === "template_assets") {
      return {
        select: selectMock,
        delete: deleteMock,
        update: updateMock,
      };
    }
    return {};
  });

  getPublicUrlMock = jest.fn((path: string) => ({
    data: { publicUrl: `https://cdn.lumiso.test/${path}` },
  }));
  removeMock = jest.fn().mockResolvedValue({ error: null });
  storageFromMock.mockReturnValue({
    getPublicUrl: getPublicUrlMock,
    remove: removeMock,
  });

  toastMock.mockClear();
  clipboardWriteMock.mockClear();
  useOrganizationMock.mockReturnValue({
    activeOrganization: { id: "org-1" },
  });
});

afterEach(() => {
  jest.clearAllMocks();
});

const renderSheet = (props: Partial<React.ComponentProps<typeof ImageLibrarySheet>> = {}) => {
  const defaultProps = {
    open: true,
    onOpenChange: jest.fn(),
    onImageSelect: jest.fn(),
  };

  return render(<ImageLibrarySheet {...defaultProps} {...props} />);
};

describe("ImageLibrarySheet", () => {
  it("loads organization assets and allows selecting an image", async () => {
    const onImageSelect = jest.fn();
    const onOpenChange = jest.fn();

    renderSheet({ onImageSelect, onOpenChange });

    await waitFor(() => {
      expect(orderMock).toHaveBeenCalled();
    });

    const insertButton = await screen.findByRole("button", {
      name: "templateBuilder.imageManager.actions.insert",
    });
    fireEvent.click(insertButton);

    expect(onImageSelect).toHaveBeenCalledWith(
      "https://cdn.lumiso.test/studio.jpg",
      "Studio setup"
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);

    fireEvent.click(screen.getByLabelText("templateBuilder.imageManager.actions.copyUrl"));
    await waitFor(() => {
      expect(clipboardWriteMock).toHaveBeenCalledWith("https://cdn.lumiso.test/studio.jpg");
      expect(toastMock).toHaveBeenCalledWith({
        title: "toast.success",
        description: "templateBuilder.imageManager.messages.copySuccess",
      });
    });
  });

  it("edits alt text and persists changes", async () => {
    renderSheet();

    await waitFor(() => {
      expect(orderMock).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByLabelText("templateBuilder.imageManager.actions.editAlt"));

    const input = screen.getByPlaceholderText("templateBuilder.imageManager.actions.altPlaceholder");
    fireEvent.change(input, { target: { value: "New description" } });

    fireEvent.click(screen.getByLabelText("templateBuilder.imageManager.actions.confirmAlt"));

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith({ alt_text: "New description" });
      expect(updateEqMock).toHaveBeenCalledWith("id", "asset-1");
    });

    expect(toastMock).toHaveBeenCalledWith({
      title: "toast.success",
      description: "templateBuilder.imageManager.messages.altSuccess",
    });
  });

  it("removes an asset from storage and database", async () => {
    renderSheet();

    await waitFor(() => {
      expect(orderMock).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByLabelText("templateBuilder.imageManager.actions.deleteAria"));
    fireEvent.click(screen.getByRole("button", { name: "buttons.delete" }));

    await waitFor(() => {
      expect(removeMock).toHaveBeenCalledWith(["studio.jpg"]);
      expect(deleteMock).toHaveBeenCalled();
      expect(deleteEqMock).toHaveBeenCalledWith("id", "asset-1");
    });

    expect(toastMock).toHaveBeenCalledWith({
      title: "toast.success",
      description: "templateBuilder.imageManager.messages.deleteSuccess",
    });
  });
});
