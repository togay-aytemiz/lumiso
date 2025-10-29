import React from "react";
import { fireEvent, render, screen, waitFor } from "@/utils/testUtils";
import { ImageUpload } from "../ImageUpload";

const toastMock = jest.fn();
const useAuthMock = jest.fn();
const useOrganizationMock = jest.fn();
const fromMock = jest.fn();
const storageFromMock = jest.fn();

const checkStorageLimitsMock = jest.fn();

jest.mock("../StorageQuotaDisplay", () => ({
  checkStorageLimits: (...args: unknown[]) => checkStorageLimitsMock(...args),
}));

jest.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: (...args: unknown[]) => toastMock(...args),
  }),
}));

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => useAuthMock(),
}));

jest.mock("@/contexts/OrganizationContext", () => ({
  useOrganization: () => useOrganizationMock(),
}));

jest.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
    storage: {
      from: (...args: unknown[]) => storageFromMock(...args),
    },
  },
}));

const selectUsageMock = jest.fn();
const insertAssetMock = jest.fn();
const uploadMock = jest.fn();
const getPublicUrlMock = jest.fn();

beforeEach(() => {
  toastMock.mockClear();
  fromMock.mockReset();
  storageFromMock.mockReset();
  selectUsageMock.mockReset().mockReturnValue({
    data: { total_images: 1, total_storage_bytes: 1_000_000 },
    error: null,
  });
  insertAssetMock.mockResolvedValue({ error: null });
  uploadMock.mockResolvedValue({ error: null });
  getPublicUrlMock.mockReturnValue({ data: { publicUrl: "https://cdn.lumiso.test/image.jpg" } });
  checkStorageLimitsMock.mockReturnValue({ canUpload: true });
  useAuthMock.mockReturnValue({ user: { id: "user-1" } });
  useOrganizationMock.mockReturnValue({ activeOrganization: { id: "org-1" } });

  fromMock.mockImplementation((table: string) => {
    switch (table) {
      case "template_image_usage":
        return {
          select: () => ({
            eq: () => ({
              single: selectUsageMock,
            }),
          }),
        };
      case "template_assets":
        return {
          insert: insertAssetMock,
        };
      default:
        return {};
    }
  });

  storageFromMock.mockReturnValue({
    upload: uploadMock,
    getPublicUrl: getPublicUrlMock,
  });
});

const createFile = (name: string, type: string, size: number) => {
  const blob = new Blob(["x".repeat(size)], { type });
  return new File([blob], name, { type, lastModified: Date.now() });
};

const triggerFileSelection = (file: File) => {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file] } });
};

describe("ImageUpload", () => {
  it("rejects non-image files", () => {
    render(<ImageUpload onImageUploaded={jest.fn()} />);
    triggerFileSelection(createFile("document.pdf", "application/pdf", 1000));

    expect(toastMock).toHaveBeenCalledWith({
      title: "Error",
      description: "Please select an image file",
      variant: "destructive",
    });
  });

  it("rejects files over 5MB", () => {
    render(<ImageUpload onImageUploaded={jest.fn()} />);
    triggerFileSelection(createFile("huge.jpg", "image/jpeg", 6 * 1024 * 1024));

    expect(toastMock).toHaveBeenCalledWith({
      title: "Error",
      description: "Image must be smaller than 5MB",
      variant: "destructive",
    });
  });

  it("respects storage limits before uploading", async () => {
    checkStorageLimitsMock.mockReturnValueOnce({ canUpload: false, reason: "Limit reached" });

    render(<ImageUpload onImageUploaded={jest.fn()} />);
    triggerFileSelection(createFile("photo.jpg", "image/jpeg", 1024));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith({
        title: "Upload Limit Reached",
        description: "Limit reached",
        variant: "destructive",
      });
    });
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it("uploads image and records asset", async () => {
    const handleUploaded = jest.fn();
    render(<ImageUpload onImageUploaded={handleUploaded} />);

    triggerFileSelection(createFile("photo.jpg", "image/jpeg", 1024));

    await waitFor(() => {
      expect(uploadMock).toHaveBeenCalled();
      expect(insertAssetMock).toHaveBeenCalled();
    });

    expect(handleUploaded).toHaveBeenCalledWith("https://cdn.lumiso.test/image.jpg", "photo");
    expect(toastMock).toHaveBeenCalledWith({
      title: "Success",
      description: "Image uploaded successfully",
    });
  });

  it("handles upload errors gracefully", async () => {
    uploadMock.mockResolvedValueOnce({ error: new Error("upload failed") });
    const handleUploaded = jest.fn();

    render(<ImageUpload onImageUploaded={handleUploaded} />);
    triggerFileSelection(createFile("photo.jpg", "image/jpeg", 1024));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith({
        title: "Error",
        description: "Failed to upload image",
        variant: "destructive",
      });
    });

    expect(handleUploaded).not.toHaveBeenCalled();
  });
});
