import DOMPurify from "dompurify";

const SANITIZE_CONFIG: DOMPurify.Config = {
  ALLOWED_TAGS: [],
  ALLOWED_ATTR: [],
};

/**
 * Removes any HTML tags or scripts from the provided note text while keeping
 * markdown characters (like **bold**) intact. The result is safe to store or render.
 */
export function sanitizeNotesInput(value: string): string {
  if (!value) {
    return "";
  }

  try {
    return DOMPurify.sanitize(value, SANITIZE_CONFIG);
  } catch (error) {
    console.error("Failed to sanitize notes input", error);
    return value.replace(/<[^>]*>/g, "");
  }
}
