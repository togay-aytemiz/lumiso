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
