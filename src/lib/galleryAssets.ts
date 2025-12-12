export const GALLERY_ASSETS_BUCKET = "gallery-assets";

export const DEFAULT_PROOF_LONG_EDGE_PX = 2560;
export const DEFAULT_PROOF_WEBP_QUALITY = 0.82;

export type ConvertedProof = {
  blob: Blob;
  width: number;
  height: number;
  contentType: string;
  extension: string;
};

type DecodedImage = {
  source: ImageBitmap | HTMLImageElement;
  width: number;
  height: number;
  cleanup: () => void;
};

const canvasToBlob = (
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number
): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error(`Canvas export failed (${type})`));
          return;
        }
        resolve(blob);
      },
      type,
      quality
    );
  });

const decodeImage = async (file: File): Promise<DecodedImage> => {
  if (typeof window === "undefined") {
    throw new Error("Image decoding is only supported in the browser");
  }

  if (typeof window.createImageBitmap === "function") {
    try {
      const bitmap = await window.createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        cleanup: () => bitmap.close?.(),
      };
    } catch {
      const bitmap = await window.createImageBitmap(file);
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        cleanup: () => bitmap.close?.(),
      };
    }
  }

  const url = URL.createObjectURL(file);
  return await new Promise<DecodedImage>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      resolve({
        source: image,
        width: image.naturalWidth,
        height: image.naturalHeight,
        cleanup: () => URL.revokeObjectURL(url),
      });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Image decode failed"));
    };
    image.src = url;
  });
};

export const buildGalleryProofPath = ({
  organizationId,
  galleryId,
  assetId,
  extension,
}: {
  organizationId: string;
  galleryId: string;
  assetId: string;
  extension: string;
}) => `${organizationId}/galleries/${galleryId}/proof/${assetId}.${extension}`;

export const getStorageBasename = (path: string) => {
  const parts = path.split("/");
  return parts[parts.length - 1] || path;
};

export const convertImageToProof = async (
  file: File,
  options?: { longEdgePx?: number; webpQuality?: number }
): Promise<ConvertedProof> => {
  if (!file.type.startsWith("image/")) {
    throw new Error("Only image uploads are supported right now.");
  }

  const longEdgePx = options?.longEdgePx ?? DEFAULT_PROOF_LONG_EDGE_PX;
  const webpQuality = options?.webpQuality ?? DEFAULT_PROOF_WEBP_QUALITY;

  const decoded = await decodeImage(file);
  try {
    const scale = Math.min(1, longEdgePx / Math.max(decoded.width, decoded.height));
    const width = Math.max(1, Math.round(decoded.width * scale));
    const height = Math.max(1, Math.round(decoded.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d", { alpha: false });
    if (!context) {
      throw new Error("Canvas context unavailable");
    }

    context.drawImage(decoded.source, 0, 0, width, height);

    try {
      const blob = await canvasToBlob(canvas, "image/webp", webpQuality);
      return { blob, width, height, contentType: "image/webp", extension: "webp" };
    } catch {
      const blob = await canvasToBlob(canvas, "image/jpeg", 0.9);
      return { blob, width, height, contentType: "image/jpeg", extension: "jpg" };
    }
  } finally {
    decoded.cleanup();
  }
};

