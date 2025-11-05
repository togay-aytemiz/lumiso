export interface StorageUsage {
  total_images: number;
  total_storage_bytes: number;
}

export const STORAGE_LIMITS = {
  MAX_IMAGES: 20,
  MAX_STORAGE_BYTES: 50 * 1024 * 1024, // 50MB
} as const;

export function checkStorageLimits(
  currentUsage: StorageUsage,
  newFileSize: number
): { canUpload: boolean; reason?: string } {
  if (currentUsage.total_images >= STORAGE_LIMITS.MAX_IMAGES) {
    return {
      canUpload: false,
      reason: `Maximum number of images (${STORAGE_LIMITS.MAX_IMAGES}) reached. Please delete some images first.`,
    };
  }

  if (
    currentUsage.total_storage_bytes + newFileSize >
    STORAGE_LIMITS.MAX_STORAGE_BYTES
  ) {
    const remainingMB =
      (STORAGE_LIMITS.MAX_STORAGE_BYTES - currentUsage.total_storage_bytes) /
      (1024 * 1024);
    return {
      canUpload: false,
      reason: `Not enough storage space. Only ${remainingMB.toFixed(
        1
      )}MB remaining.`,
    };
  }

  return { canUpload: true };
}
