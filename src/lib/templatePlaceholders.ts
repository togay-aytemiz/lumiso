const buildPattern = (double: boolean) =>
  double
    ? /\{\{\s*([a-zA-Z0-9_]+)\s*(?:\|([^}]*))?\s*\}\}/g
    : /\{\s*([a-zA-Z0-9_]+)\s*(?:\|([^}]*))?\s*\}/g;

export function replacePlaceholders(
  text: string,
  data: Record<string, string>,
  allowFallbacks = true
): string {
  const applyPattern = (input: string, pattern: RegExp) =>
    input.replace(pattern, (match, key, fallback) => {
      const replacement = data[key];
      if (replacement !== undefined) {
        return replacement;
      }
      if (allowFallbacks && fallback !== undefined) {
        return fallback;
      }
      return match;
    });

  let result = text;
  result = applyPattern(result, buildPattern(true));
  result = applyPattern(result, buildPattern(false));
  return result;
}
