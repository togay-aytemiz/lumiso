import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SessionRow {
  id: string;
  session_date: string | null;
  session_time: string | null;
  status: string | null;
}

export interface ProjectSessionsSummary {
  total: number;
  activeCount: number;
  completedCount: number;
  cancelledCount: number;
  overdueCount: number;
  overdueNext: SessionRow | null;
  todayCount: number;
  todayNext: SessionRow | null;
  nextUpcoming: SessionRow | null;
  latestCompleted: SessionRow | null;
}

const initialSummary: ProjectSessionsSummary = {
  total: 0,
  activeCount: 0,
  completedCount: 0,
  cancelledCount: 0,
  overdueCount: 0,
  overdueNext: null,
  todayCount: 0,
  todayNext: null,
  nextUpcoming: null,
  latestCompleted: null,
};

const ACTIVE_STATUSES = new Set(['planned', 'upcoming', 'confirmed', 'scheduled']);
const COMPLETED_STATUSES = new Set(['completed', 'delivered', 'in_post_processing', 'editing', 'edited']);
const CANCELLED_STATUSES = new Set(['cancelled', 'canceled']);

const normalizeStatus = (status?: string | null) => (status || '').toLowerCase();

const getComparableDate = (session: SessionRow): Date | null => {
  if (!session.session_date) {
    return null;
  }

  const time = session.session_time ? session.session_time.slice(0, 8) : '00:00';
  const iso = `${session.session_date}T${time}`;
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
};

const compareDatesAsc = (a: SessionRow, b: SessionRow) => {
  const dateA = getComparableDate(a);
  const dateB = getComparableDate(b);

  if (!dateA && !dateB) return 0;
  if (!dateA) return 1;
  if (!dateB) return -1;

  return dateA.getTime() - dateB.getTime();
};

const compareDatesDesc = (a: SessionRow, b: SessionRow) => -compareDatesAsc(a, b);

const getDateKey = (value: string | null) => (value ? value.slice(0, 10) : null);

export const useProjectSessionsSummary = (projectId: string, refreshTrigger?: number) => {
  const [summary, setSummary] = useState<ProjectSessionsSummary>(initialSummary);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) {
      setSummary(initialSummary);
      setLoading(false);
      return;
    }

    const fetchSessions = async () => {
      setLoading(true);

      try {
        const { data, error } = await supabase
          .from('sessions')
          .select('id, session_date, session_time, status')
          .eq('project_id', projectId)
          .order('session_date', { ascending: true })
          .order('session_time', { ascending: true, nullsFirst: true });

        if (error) throw error;

        const sessions = (data || []) as SessionRow[];
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
          today.getDate()
        ).padStart(2, '0')}`;

        const active: SessionRow[] = [];
        const completed: SessionRow[] = [];
        const cancelled: SessionRow[] = [];

        sessions.forEach((session) => {
          const normalized = normalizeStatus(session.status);

          if (CANCELLED_STATUSES.has(normalized)) {
            cancelled.push(session);
            return;
          }

          if (COMPLETED_STATUSES.has(normalized)) {
            completed.push(session);
            return;
          }

          if (ACTIVE_STATUSES.has(normalized) || !normalized) {
            active.push(session);
            return;
          }

          // Default to active for unrecognized statuses so they appear in planning
          active.push(session);
        });

        const activeSorted = [...active].sort(compareDatesAsc);
        const completedSorted = [...completed].sort(compareDatesDesc);

        const overdue = activeSorted.filter((session) => {
          const sessionKey = getDateKey(session.session_date);
          return sessionKey !== null && sessionKey < todayKey;
        });

        const todaySessions = activeSorted.filter((session) => {
          const sessionKey = getDateKey(session.session_date);
          return sessionKey !== null && sessionKey === todayKey;
        });

        const upcoming = activeSorted.filter((session) => {
          const sessionKey = getDateKey(session.session_date);
          return sessionKey !== null && sessionKey > todayKey;
        });

        setSummary({
          total: sessions.length,
          activeCount: active.length,
          completedCount: completed.length,
          cancelledCount: cancelled.length,
          overdueCount: overdue.length,
          overdueNext: overdue[0] ?? null,
          todayCount: todaySessions.length,
          todayNext: todaySessions[0] ?? null,
          nextUpcoming: upcoming[0] ?? null,
          latestCompleted: completedSorted[0] ?? null,
        });
      } catch (error) {
        console.error('Error fetching project sessions summary:', error);
        setSummary(initialSummary);
      } finally {
        setLoading(false);
      }
    };

    fetchSessions();
  }, [projectId, refreshTrigger]);

  return { summary, loading };
};
