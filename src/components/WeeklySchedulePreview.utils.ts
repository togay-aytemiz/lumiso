export const MINUTES_IN_DAY = 24 * 60;
export const PIXELS_PER_MINUTE = 0.9;
export const MIN_BLOCK_HEIGHT = 36;
export const MIN_VIEW_RANGE = 6 * 60;
export const DEFAULT_DRAFT_DURATION = 60;

export const parseTimeToMinutes = (time?: string | null): number | null => {
  if (!time) return null;
  const [hours, minutes] = time.split(":").map((part) => Number(part) || 0);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
};

export const clampRange = (
  start: number,
  end: number
): { start: number; end: number } => {
  let rangeStart = Math.max(0, start);
  let rangeEnd = Math.min(MINUTES_IN_DAY, end);
  if (rangeEnd <= rangeStart) {
    rangeStart = 9 * 60;
    rangeEnd = rangeStart + MIN_VIEW_RANGE;
  }
  if (rangeEnd - rangeStart < MIN_VIEW_RANGE) {
    const deficit = MIN_VIEW_RANGE - (rangeEnd - rangeStart);
    const adjustStart = Math.max(0, rangeStart - deficit / 2);
    const adjustEnd = Math.min(MINUTES_IN_DAY, adjustStart + MIN_VIEW_RANGE);
    rangeStart = Math.max(0, adjustEnd - MIN_VIEW_RANGE);
    rangeEnd = adjustEnd;
  }
  return { start: rangeStart, end: rangeEnd };
};
