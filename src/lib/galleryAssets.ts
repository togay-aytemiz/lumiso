export const GALLERY_ASSETS_BUCKET = "gallery-assets";

export const DEFAULT_PROOF_LONG_EDGE_PX = 2560;
export const DEFAULT_PROOF_WEBP_QUALITY = 0.82;
export const DEFAULT_THUMB_LONG_EDGE_PX = 640;
export const DEFAULT_THUMB_WEBP_QUALITY = 0.72;

export type ConvertedProof = {
  blob: Blob;
  width: number;
  height: number;
  contentType: string;
  extension: string;
};

type ImageVariantOptions = {
  longEdgePx: number;
  webpQuality?: number;
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

export const buildGalleryOriginalPath = ({
  organizationId,
  galleryId,
  assetId,
  extension,
}: {
  organizationId: string;
  galleryId: string;
  assetId: string;
  extension: string;
}) => `${organizationId}/galleries/${galleryId}/original/${assetId}.${extension}`;

export const buildGalleryThumbnailPath = ({
  organizationId,
  galleryId,
  assetId,
  extension,
}: {
  organizationId: string;
  galleryId: string;
  assetId: string;
  extension: string;
}) => `${organizationId}/galleries/${galleryId}/thumb/${assetId}.${extension}`;

export const getStorageBasename = (path: string) => {
  const parts = path.split("/");
  return parts[parts.length - 1] || path;
};

export const isSupabaseStorageObjectMissingError = (error: unknown) => {
  if (!error || typeof error !== "object") return false;
  const statusCode = (error as { statusCode?: number }).statusCode;
  if (statusCode === 404) return true;
  const message = (error as { message?: unknown }).message;
  if (typeof message !== "string") return false;
  return message.toLowerCase().includes("not found");
};

const convertDecodedImage = async (
  decoded: DecodedImage,
  options: ImageVariantOptions
): Promise<ConvertedProof> => {
  const longEdgePx = Math.max(1, options.longEdgePx);
  const webpQuality = options.webpQuality ?? DEFAULT_PROOF_WEBP_QUALITY;

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
};

export const convertImageToVariants = async <T extends string>(
  file: File,
  variants: Record<T, ImageVariantOptions>
): Promise<Record<T, ConvertedProof>> => {
  if (!file.type.startsWith("image/")) {
    throw new Error("Only image uploads are supported right now.");
  }

  const decoded = await decodeImage(file);
  try {
    const entries = await Promise.all(
      Object.entries(variants).map(async ([key, options]) => {
        const variant = await convertDecodedImage(decoded, options);
        return [key, variant] as const;
      })
    );
    return Object.fromEntries(entries) as Record<T, ConvertedProof>;
  } finally {
    decoded.cleanup();
  }
};

export const convertImageToProof = async (
  file: File,
  options?: { longEdgePx?: number; webpQuality?: number }
): Promise<ConvertedProof> => {
  const longEdgePx = options?.longEdgePx ?? DEFAULT_PROOF_LONG_EDGE_PX;
  const webpQuality = options?.webpQuality ?? DEFAULT_PROOF_WEBP_QUALITY;
  const { proof } = await convertImageToVariants(file, {
    proof: { longEdgePx, webpQuality },
  });
  return proof;
};

export const getImageDimensions = async (file: File): Promise<{ width: number; height: number } | null> => {
  if (!file.type.startsWith("image/")) return null;
  try {
    const decoded = await decodeImage(file);
    try {
      return { width: decoded.width, height: decoded.height };
    } finally {
      decoded.cleanup();
    }
  } catch {
    return null;
  }
};
