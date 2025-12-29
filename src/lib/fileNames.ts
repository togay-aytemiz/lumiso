export const sanitizeFileBasename = (value: string) => {
  const withoutControlChars = Array.from(value)
    .filter((char) => char.charCodeAt(0) >= 32)
    .join("");
  const normalized = withoutControlChars
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[<>:"/\\|?*]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized || "selection";
};

export const stripFileExtension = (value: string) => value.replace(/\.[^/.]+$/, "");

export const getBasename = (value: string) => {
  const withoutQuery = value.split("?")[0]?.split("#")[0] ?? value;
  const normalized = withoutQuery.replace(/\\/g, "/");
  const parts = normalized.split("/");
  return parts[parts.length - 1] || withoutQuery || value;
};

export const getFileExtension = (filename: string) => {
  const match = filename.match(/\.([a-z0-9]+)$/i);
  return match?.[1]?.toLowerCase() ?? "";
};

export const buildDownloadFilename = ({
  originalName,
  extension,
  fallback = "photo",
}: {
  originalName: string;
  extension: string;
  fallback?: string;
}) => {
  const base = stripFileExtension((originalName || "").trim()) || fallback;
  const ext = (extension || "").trim().replace(/^\./, "");
  return ext ? `${base}.${ext}` : base;
};
