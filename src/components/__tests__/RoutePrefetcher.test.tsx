import { render, waitFor } from "@testing-library/react";
import RoutePrefetcher from "../RoutePrefetcher";
import { MemoryRouter } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

jest.mock("@/contexts/OrganizationContext", () => ({
  useOrganization: jest.fn(),
}));

const useOrganizationMock = jest.requireMock("@/contexts/OrganizationContext")
  .useOrganization as jest.Mock;

jest.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: jest.fn(),
    from: jest.fn(),
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }),
    },
  },
}));

const supabaseRpcMock = supabase.rpc as jest.Mock;
const supabaseFromMock = supabase.from as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  useOrganizationMock.mockReturnValue({
    activeOrganizationId: "org-1",
  });
});

const renderWithPath = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <RoutePrefetcher />
    </MemoryRouter>
  );

describe("RoutePrefetcher", () => {
  it("prefetches projects data when navigating to projects path", async () => {
    supabaseRpcMock.mockResolvedValue({
      data: [{ total_count: 5 }],
      error: null,
    });

    renderWithPath("/projects");

    await waitFor(() =>
      expect(supabaseRpcMock).toHaveBeenCalledWith("projects_filter_page", expect.any(Object))
    );

    const stored = localStorage.getItem("prefetch:projects:first:org-1:active");
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored ?? "{}");
    expect(parsed.value.items).toEqual([{ total_count: 5 }]);
  });

  it("skips prefetch when cache entry is still fresh", async () => {
    const cacheKey = "prefetch:projects:first:org-1:active";
    localStorage.setItem(
      cacheKey,
      JSON.stringify({ ts: Date.now(), value: { ttl: 60_000 } })
    );

    renderWithPath("/projects");

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(supabaseRpcMock).not.toHaveBeenCalled();
  });

  it("prefetches leads list and metrics on leads path", async () => {
    supabaseRpcMock.mockResolvedValue({
      data: [{ total_count: 2 }],
      error: null,
    });

    const gteMock = jest.fn(() =>
      Promise.resolve({ data: [], error: null })
    );
    const eqMock = jest.fn(() => ({ gte: gteMock }));
    const selectMock = jest.fn(() => ({ eq: eqMock }));
    supabaseFromMock.mockReturnValue({ select: selectMock });

    renderWithPath("/leads");

    await waitFor(() =>
      expect(supabaseRpcMock).toHaveBeenCalledWith("leads_filter_page", expect.any(Object))
    );
    expect(selectMock).toHaveBeenCalled();
    expect(eqMock).toHaveBeenCalled();
    expect(gteMock).toHaveBeenCalled();
  });
});
