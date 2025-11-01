import { renderHook } from '@testing-library/react';
import { useSmartTimeRange } from '../useSmartTimeRange';

const mockGetCurrentTime = jest.fn();

jest.mock('@/hooks/useOrganizationTimezone', () => ({
  useOrganizationTimezone: () => ({
    timeFormat: '24-hour',
    getCurrentTime: mockGetCurrentTime
  })
}));

describe('useSmartTimeRange', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCurrentTime.mockImplementation(() => new Date(2024, 4, 15, 14, 0, 0));
  });

  it('centers the range around the current time when there are no events', () => {
    const { result } = renderHook(() => useSmartTimeRange([], []));

    const times = result.current.timeSlots.map(slot => slot.time);

    expect(times[0]).toBe('10:00');
    expect(times).toContain('14:00');
    expect(times[times.length - 1]).toBe('18:00');
  });

  it('broadens to include early events while keeping the present in view', () => {
    const sessions = [
      {
        id: 'session-1',
        session_date: '2024-05-15',
        session_time: '08:30',
        status: 'scheduled',
        lead_id: 'lead-1',
        project_id: null
      }
    ];

    const { result } = renderHook(() => useSmartTimeRange(sessions, []));

    expect(result.current.timeRangeStats.startTime).toBe('07:30');
    expect(result.current.timeSlots).toEqual(expect.arrayContaining([expect.objectContaining({ time: '14:00' })]));
    expect(result.current.timeSlots.findIndex(slot => slot.time === '14:00')).toBeGreaterThan(0);
  });

  it('extends later in the day when evening events are present', () => {
    const sessions = [
      {
        id: 'session-1',
        session_date: '2024-05-15',
        session_time: '21:15',
        status: 'scheduled',
        lead_id: 'lead-1',
        project_id: null
      }
    ];

    const { result } = renderHook(() => useSmartTimeRange(sessions, []));

    const times = result.current.timeSlots.map(slot => slot.time);
    expect(times[0]).toBe('10:00');
    expect(times.includes('23:00')).toBe(true);
  });
});
