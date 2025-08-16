/**
 * Trims leading/trailing spaces and collapses multiple spaces between words
 * @param value - The input string to trim
 * @returns Cleaned string with normalized spacing
 */
export const trimAndNormalizeSpaces = (value: string): string => {
  return value
    .trim() // Remove leading and trailing spaces
    .replace(/\s+/g, ' '); // Replace multiple spaces with single space
};

/**
 * Enhanced input change handler that applies trimming
 * @param setValue - State setter function
 * @param trimOnChange - Whether to trim while typing (default: false for better UX)
 * @returns Change handler function
 */
export const createTrimmedInputHandler = (
  setValue: (value: string) => void,
  trimOnChange: boolean = false
) => {
  return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = e.target.value;
    setValue(trimOnChange ? trimAndNormalizeSpaces(value) : value);
  };
};

/**
 * Blur handler that applies trimming when user leaves the field
 * @param value - Current input value
 * @param setValue - State setter function
 * @returns Blur handler function
 */
export const createTrimmedBlurHandler = (
  value: string,
  setValue: (value: string) => void
) => {
  return () => {
    const trimmedValue = trimAndNormalizeSpaces(value);
    if (trimmedValue !== value) {
      setValue(trimmedValue);
    }
  };
};