import { render, screen, fireEvent, waitFor } from "@/utils/testUtils";
import { ImageUpload } from "../ImageUpload";
import { ImageLibrarySheet } from "../ImageLibrarySheet";
import { TemplateErrorBoundary } from "../TemplateErrorBoundary";
import { EmojiPicker } from "../EmojiPicker";
import React from "react";

const toastMock = jest.fn();
const clipboardWriteMock = jest.fn();
const uploadMock = jest.fn();
const removeMock = jest.fn();

jest.mock("react-i18next", () => ({
  useTranslation: jest.fn(() => ({
    t: (key: string, vars?: Record<string, unknown>) =>
      vars && "name" in vars ? `${key}:${vars.name}` : key,
  })),
  withTranslation: () => (Component: React.ComponentType<any>) =>
    (props: Record<string, unknown>) =>
      <Component t={(key: string) => key} {...props} />,
}));

jest.mock("@/hooks/useTypedTranslation", () => ({
  useMessagesTranslation: jest.fn(() => ({
    t: (key: string, vars?: Record<string, unknown>) =>
      vars && "name" in vars ? `${key}:${vars.name}` : key,
  })),
}));

jest.mock("@/hooks/use-toast", () => ({
  useToast: jest.fn(),
  toast: jest.fn(),
}));

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: jest.fn(),
}));

jest.mock("@/contexts/OrganizationContext", () => ({
  useOrganization: jest.fn(),
}));

jest.mock("../StorageQuotaDisplay", () => ({
  checkStorageLimits: jest.fn(() => ({ canUpload: true })),
  CompactStorageIndicator: () => <div data-testid="mock-storage-indicator" />,
}));

jest.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: jest.fn(),
    storage: {
      from: jest.fn(),
    },
  },
}));

const { useToast } = require("@/hooks/use-toast") as {
  useToast: jest.Mock;
};
const { useAuth } = require("@/contexts/AuthContext") as {
  useAuth: jest.Mock;
};
const { useOrganization } = require("@/contexts/OrganizationContext") as {
  useOrganization: jest.Mock;
};
const { checkStorageLimits } = require("../StorageQuotaDisplay") as {
  checkStorageLimits: jest.Mock;
};
const supabase = require("@/integrations/supabase/client")
  .supabase as any;

beforeEach(() => {
  jest.clearAllMocks();
  toastMock.mockReset();
  clipboardWriteMock.mockReset();
  uploadMock.mockReset();
  removeMock.mockReset();

  useToast.mockReturnValue({ toast: toastMock });
  useAuth.mockReturnValue({ user: { id: "user-1" } });
  useOrganization.mockReturnValue({
    activeOrganization: { id: "org-1" },
  });
  checkStorageLimits.mockReturnValue({ canUpload: true });
  uploadMock.mockResolvedValue({ error: null });
  removeMock.mockResolvedValue({ error: null });

  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: clipboardWriteMock },
  });

  supabase.storage.from.mockReturnValue({
    upload: uploadMock,
    getPublicUrl: jest.fn(() => ({
      data: { publicUrl: "https://cdn.local/photo.png" },
    })),
    remove: removeMock,
  });

  supabase.from.mockImplementation(() => ({}));
});

describe("ImageUpload", () => {
  const mockUsageResponse = (usage: {
    total_images: number;
    total_storage_bytes: number;
  }) => {
    const singleMock = jest
      .fn()
      .mockResolvedValue({ data: usage, error: null });
    const eqMock = jest.fn(() => ({ single: singleMock }));
    const selectMock = jest.fn(() => ({ eq: eqMock }));
    return { singleMock, eqMock, selectMock };
  };

  const setUsageMocks = (usage: {
    total_images: number;
    total_storage_bytes: number;
  }) => {
    const { selectMock } = mockUsageResponse(usage);
    const insertMock = jest.fn().mockResolvedValue({ error: null });

    supabase.from.mockImplementation((table: string) => {
      if (table === "template_image_usage") {
        return { select: selectMock };
      }
      if (table === "template_assets") {
        return { insert: insertMock };
      }
      return {};
    });

    return { insertMock };
  };

  it("uploads an image successfully and invokes callbacks", async () => {
    const { insertMock } = setUsageMocks({
      total_images: 5,
      total_storage_bytes: 2 * 1024 * 1024,
    });

    const onImageUploaded = jest.fn();
    const { container } = render(
      <ImageUpload onImageUploaded={onImageUploaded} />
    );

    const input = container.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    const file = new File(["content"], "hero.png", {
      type: "image/png",
    });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() =>
      expect(onImageUploaded).toHaveBeenCalledWith(
        "https://cdn.local/photo.png",
        "hero"
      )
    );

    expect(uploadMock).toHaveBeenCalledWith(
      expect.stringMatching(/^template-images\/.+\.png$/),
      file
    );
    expect(insertMock).toHaveBeenCalled();
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Success" })
    );
  });

  it("rejects uploads when no authenticated user is present", () => {
    useAuth.mockReturnValue({ user: null });
    const { container } = render(
      <ImageUpload onImageUploaded={jest.fn()} />
    );

    const input = container.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    const file = new File(["content"], "hero.png", {
      type: "image/png",
    });

    fireEvent.change(input, { target: { files: [file] } });

    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        description: "You must be logged in to upload images",
        variant: "destructive",
      })
    );
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it("rejects files that are not images", () => {
    const { container } = render(
      <ImageUpload onImageUploaded={jest.fn()} />
    );

    const input = container.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    const file = new File(["content"], "document.txt", {
      type: "text/plain",
    });

    fireEvent.change(input, { target: { files: [file] } });

    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        description: "Please select an image file",
        variant: "destructive",
      })
    );
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it("rejects images over the size limit", () => {
    const { container } = render(
      <ImageUpload onImageUploaded={jest.fn()} />
    );

    const bigBuffer = new Uint8Array(5 * 1024 * 1024 + 1);
    const bigFile = new File([bigBuffer], "large.png", {
      type: "image/png",
    });

    const input = container.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [bigFile] } });

    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        description: "Image must be smaller than 5MB",
        variant: "destructive",
      })
    );
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it("surfaces storage limit errors reported by checkStorageLimits", async () => {
    checkStorageLimits.mockReturnValueOnce({
      canUpload: false,
      reason: "No quota remaining",
    });
    setUsageMocks({
      total_images: 50,
      total_storage_bytes: 49 * 1024 * 1024,
    });

    const { container } = render(
      <ImageUpload onImageUploaded={jest.fn()} />
    );

    const input = container.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    const file = new File(["content"], "hero.png", {
      type: "image/png",
    });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Upload Limit Reached",
          description: "No quota remaining",
        })
      )
    );
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it("handles upload failures gracefully", async () => {
    setUsageMocks({
      total_images: 5,
      total_storage_bytes: 1024,
    });
    uploadMock.mockResolvedValueOnce({ error: new Error("upload failed") });

    const { container } = render(
      <ImageUpload onImageUploaded={jest.fn()} />
    );

    const input = container.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    const file = new File(["content"], "hero.png", {
      type: "image/png",
    });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          description: "Failed to upload image",
          variant: "destructive",
        })
      )
    );
  });
});

describe("ImageLibrarySheet", () => {
  const assets = [
    {
      id: "asset-1",
      file_name: "hero.png",
      file_path: "template-images/hero.png",
      file_size: 1024,
      content_type: "image/png",
      alt_text: "Hero shot",
      created_at: "2025-01-01T00:00:00Z",
    },
  ];

  const setupSupabaseAssets = (overrides?: {
    selectError?: Error | null;
    updateError?: Error | null;
    deleteError?: Error | null;
    reloadData?: any[];
  }) => {
    const orderMock = jest
      .fn()
      .mockResolvedValueOnce({
        data: overrides?.selectError ? null : assets,
        error: overrides?.selectError ?? null,
      });

    if (overrides?.reloadData) {
      orderMock.mockResolvedValueOnce({
        data: overrides.reloadData,
        error: null,
      });
    }

    const eqSelectMock = jest.fn(() => ({ order: orderMock }));
    const selectMock = jest.fn(() => ({ eq: eqSelectMock }));

    const updateEqMock = jest.fn(() =>
      Promise.resolve({ error: overrides?.updateError ?? null })
    );
    const updateMock = jest.fn(() => ({ eq: updateEqMock }));

    const deleteEqMock = jest.fn(() =>
      Promise.resolve({ error: overrides?.deleteError ?? null })
    );
    const deleteMock = jest.fn(() => ({ eq: deleteEqMock }));

    supabase.from.mockImplementation((table: string) => {
      if (table === "template_assets") {
        return {
          select: selectMock,
          update: updateMock,
          delete: deleteMock,
        };
      }
      return {};
    });

    supabase.storage.from.mockReturnValue({
      upload: uploadMock,
      remove: removeMock,
      getPublicUrl: jest.fn(() => ({
        data: { publicUrl: "https://cdn.local/hero.png" },
      })),
    });

    return {
      selectMock,
      updateMock,
      deleteMock,
      deleteEqMock,
      updateEqMock,
    };
  };

  it("renders assets and copies image URLs", async () => {
    setupSupabaseAssets();

    render(
      <ImageLibrarySheet
        open
        onOpenChange={jest.fn()}
        onImageSelect={jest.fn()}
      />
    );

    await waitFor(() =>
      expect(screen.getByText("hero.png")).toBeInTheDocument()
    );

    const copyButton = screen.getByRole("button", { name: "Copy image URL" });

    fireEvent.click(copyButton);
    expect(clipboardWriteMock).toHaveBeenCalledWith(
      "https://cdn.local/hero.png"
    );
    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Success" })
      )
    );
  });

  it("allows inserting an image and closes the sheet", async () => {
    setupSupabaseAssets();

    const onOpenChange = jest.fn();
    const onImageSelect = jest.fn();

    render(
      <ImageLibrarySheet
        open
        onOpenChange={onOpenChange}
        onImageSelect={onImageSelect}
      />
    );

    await waitFor(() =>
      expect(screen.getByText("hero.png")).toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole("button", { name: "Insert" }));

    expect(onImageSelect).toHaveBeenCalledWith(
      "https://cdn.local/hero.png",
      "Hero shot"
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("supports editing alt text inline", async () => {
    const { updateMock, updateEqMock } = setupSupabaseAssets();

    render(
      <ImageLibrarySheet open onOpenChange={jest.fn()} />
    );

    await waitFor(() =>
      expect(screen.getByText("hero.png")).toBeInTheDocument()
    );

    const editButton = screen.getByRole("button", { name: "Edit alt text" });

    fireEvent.click(editButton);

    const input = screen.getByDisplayValue("Hero shot");
    fireEvent.change(input, { target: { value: "Updated alt" } });

    const confirmButton = screen.getByRole("button", { name: "Confirm alt text" });
    fireEvent.click(confirmButton);

    await waitFor(() => expect(updateMock).toHaveBeenCalled());
    expect(updateEqMock).toHaveBeenCalledWith("id", "asset-1");
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ description: "Alt text updated" })
    );
  });

  it("deletes assets and refreshes the list", async () => {
    const { deleteMock, deleteEqMock } = setupSupabaseAssets({
      reloadData: [],
    });

    render(
      <ImageLibrarySheet open onOpenChange={jest.fn()} />
    );

    await waitFor(() =>
      expect(screen.getByText("hero.png")).toBeInTheDocument()
    );

    const deleteButton = screen.getByRole("button", { name: "Delete image" });

    fireEvent.click(deleteButton);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(deleteMock).toHaveBeenCalled());
    expect(deleteEqMock).toHaveBeenCalledWith("id", "asset-1");
    expect(removeMock).toHaveBeenCalledWith(["template-images/hero.png"]);
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ description: "Image deleted successfully" })
    );
  });

  it("shows an error toast when asset loading fails", async () => {
    setupSupabaseAssets({ selectError: new Error("boom") });

    render(<ImageLibrarySheet open onOpenChange={jest.fn()} />);

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          description: "Failed to load images",
          variant: "destructive",
        })
      )
    );
  });

  it("surfaces errors when deleting an asset fails", async () => {
    setupSupabaseAssets({ deleteError: new Error("remove failed") });

    render(<ImageLibrarySheet open onOpenChange={jest.fn()} />);

    await waitFor(() =>
      expect(screen.getByText("hero.png")).toBeInTheDocument()
    );

    const deleteButton = screen.getByRole("button", { name: "Delete image" });

    fireEvent.click(deleteButton);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          description: "Failed to delete image",
          variant: "destructive",
        })
      )
    );
  });
});

describe("TemplateErrorBoundary", () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  const ThrowingComponent = () => {
    throw new Error("Boom!");
  };

  it("renders the default fallback UI with error details", () => {
    render(
      <TemplateErrorBoundary>
        <ThrowingComponent />
      </TemplateErrorBoundary>
    );

    expect(
      screen.getByText("templates.errorBoundary.title")
    ).toBeInTheDocument();
    expect(
      screen.getByText("templates.errorBoundary.errorDetails")
    ).toBeInTheDocument();
    expect(screen.getByText("Boom!")).toBeInTheDocument();
  });

  it("supports a custom fallback component", () => {
    const fallback = jest.fn(
      ({ error, reset }: { error: Error; reset: () => void }) => (
        <div>
          <p data-testid="custom-fallback">{error.message}</p>
          <button onClick={reset}>reset</button>
        </div>
      )
    );

    render(
      <TemplateErrorBoundary fallback={fallback}>
        <ThrowingComponent />
      </TemplateErrorBoundary>
    );

    expect(screen.getByTestId("custom-fallback")).toHaveTextContent(
      "Boom!"
    );
    expect(fallback).toHaveBeenCalled();
  });

  it("resets when the custom fallback invokes reset", () => {
    const Harness = () => {
      const [shouldThrow, setShouldThrow] = React.useState(true);
      return (
        <TemplateErrorBoundary
          fallback={({ reset }: { reset: () => void }) => (
            <button
              onClick={() => {
                setShouldThrow(false);
                reset();
              }}
            >
              Recover
            </button>
          )}
        >
          {shouldThrow ? (
            <ThrowingComponent />
          ) : (
            <div data-testid="recovered">Recovered</div>
          )}
        </TemplateErrorBoundary>
      );
    };

    render(<Harness />);

    fireEvent.click(screen.getByText("Recover"));
    expect(screen.getByTestId("recovered")).toBeInTheDocument();
  });
});

describe("EmojiPicker", () => {
  it("invokes the selection callback and closes the picker", async () => {
    const onEmojiSelect = jest.fn();

    render(<EmojiPicker onEmojiSelect={onEmojiSelect} />);

    const trigger = screen.getByRole("button");
    fireEvent.click(trigger);

    const emojiButton = await waitFor(() => screen.getByTitle("📸"));
    fireEvent.click(emojiButton);

    expect(onEmojiSelect).toHaveBeenCalledWith("📸");
  });

  it("supports custom trigger elements", async () => {
    const onEmojiSelect = jest.fn();

    render(
      <EmojiPicker
        onEmojiSelect={onEmojiSelect}
        trigger={<button>Open Picker</button>}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Open Picker" }));
    const emojiButton = await waitFor(() => screen.getByTitle("📸"));
    fireEvent.click(emojiButton);

    expect(onEmojiSelect).toHaveBeenCalledWith("📸");
  });
});
