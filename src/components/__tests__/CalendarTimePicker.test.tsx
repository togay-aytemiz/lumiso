import { render, screen, waitFor } from "@/utils/testUtils";
import { CalendarTimePicker } from "../CalendarTimePicker";
import { supabase } from "@/integrations/supabase/client";

jest.mock("@/components/TimeSlotPicker", () => ({
  TimeSlotPicker: () => <div data-testid="time-slot-picker" />,
}));
jest.mock("react-calendar/dist/Calendar.css", () => ({}));
jest.mock("@/components/react-calendar.css", () => ({}));
jest.mock("@/lib/organizationUtils", () => ({
  getUserOrganizationId: jest.fn(() => Promise.resolve("org-1")),
}));
jest.mock("@/hooks/useTypedTranslation", () => ({
  useFormsTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en-US" },
  }),
  useCommonTranslation: () => ({ t: (key: string) => key }),
  useMessagesTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

const scrollIntoViewMock = jest.fn();

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: scrollIntoViewMock,
  });

  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: jest.fn().mockImplementation(() => ({
      matches: false,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
});

const eqCalls: Array<{ field: string; value: unknown }> = [];
const gteCalls: Array<{ field: string; value: unknown }> = [];
const lteCalls: Array<{ field: string; value: unknown }> = [];

jest.mock("@/integrations/supabase/client", () => {
  const authGetUserMock = jest.fn(() =>
    Promise.resolve({ data: { user: { id: "user-1" } }, error: null })
  );

  const queryChain = {
    eq(field: string, value: unknown) {
      eqCalls.push({ field, value });
      return queryChain;
    },
    gte(field: string, value: unknown) {
      gteCalls.push({ field, value });
      return queryChain;
    },
    lte(field: string, value: unknown) {
      lteCalls.push({ field, value });
      return Promise.resolve({
        data: [
          {
            id: "session-1",
            session_date: "2024-05-21",
            session_time: "10:00",
            session_type_id: "type-1",
            leads: { name: "Alex" },
            projects: { name: "Wedding" },
            status: "planned",
            session_types: { duration_minutes: 90 },
          },
        ],
        error: null,
      });
    },
  };

  return {
    supabase: {
      auth: {
        getUser: authGetUserMock,
      },
      from(table: string) {
        if (table === "sessions") {
          return {
            select: () => queryChain,
          };
        }
        return {
          select: () => ({ eq: () => ({ maybeSingle: jest.fn() }) }),
        };
      },
    },
  };
});

const authGetUserMock = supabase.auth.getUser as jest.Mock;

afterEach(() => {
  jest.clearAllMocks();
  scrollIntoViewMock.mockReset();
  eqCalls.length = 0;
  gteCalls.length = 0;
  lteCalls.length = 0;
});

describe("CalendarTimePicker", () => {
  it("invokes smooth scroll when planned sessions load", async () => {
    const { rerender } = render(
      <CalendarTimePicker
        selectedDate={undefined}
        selectedTime=""
        onDateChange={jest.fn()}
        onTimeChange={jest.fn()}
        onDateStringChange={jest.fn()}
      />
    );

    await waitFor(() => expect(eqCalls.length).toBeGreaterThanOrEqual(2));

    rerender(
      <CalendarTimePicker
        selectedDate={new Date("2024-05-21T00:00:00")}
        selectedTime="10:00"
        onDateChange={jest.fn()}
        onTimeChange={jest.fn()}
        onDateStringChange={jest.fn()}
      />
    );

    await screen.findByText(/sessionScheduling.planned_sessions_on/i);
    await screen.findByText("sessionScheduling.weekly_preview_heading");
    await waitFor(() => expect(scrollIntoViewMock).toHaveBeenCalled());

    expect(authGetUserMock).toHaveBeenCalled();
    expect(eqCalls).toEqual(
      expect.arrayContaining([
        { field: "organization_id", value: "org-1" },
        { field: "status", value: "planned" },
      ])
    );
    expect(gteCalls[0]?.field).toBe("session_date");
    expect(lteCalls[0]?.field).toBe("session_date");
  });
});
