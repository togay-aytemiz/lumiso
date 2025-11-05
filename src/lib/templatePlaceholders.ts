export function replacePlaceholders(
  text: string,
  data: Record<string, string>,
  allowFallbacks = true
): string {
  if (!allowFallbacks) {
    return text.replace(/\{(\w+)\}/g, (match, key) => data[key] || match);
  }

  // Support fallback syntax: {variable|fallback}
  return text.replace(/\{(\w+)(?:\|([^}]*))?\}/g, (match, key, fallback) => {
    return data[key] || fallback || match;
  });
}
