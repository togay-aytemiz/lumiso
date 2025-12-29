export const isUploadInProgress = (status: string) =>
  status === "queued" || status === "uploading" || status === "processing";

export const shouldKeepLocalUploadItem = (item: {
  status: string;
  file?: File;
  enqueuedAt?: number;
}) => Boolean(item.file) || isUploadInProgress(item.status) || typeof item.enqueuedAt === "number";

