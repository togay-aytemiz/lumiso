jest.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: jest.fn(),
  },
}));

import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { useProjectPayments } from "../useProjectPayments";
import { supabase } from "@/integrations/supabase/client";

const supabaseFromMock = supabase.from as jest.Mock;

const createSingleChain = (result: { data: unknown; error: unknown }) => ({
  select: jest.fn(() => ({
    eq: jest.fn(() => ({
      single: jest.fn(() => Promise.resolve(result)),
    })),
  })),
});

const createPaidPaymentsChain = (result: { data: unknown; error: unknown }) => ({
  select: jest.fn(() => ({
    eq: jest.fn((_column: string, _value: unknown) => ({
      eq: jest.fn(() => Promise.resolve(result)),
    })),
  })),
});

describe("useProjectPayments", () => {
  let queryClient: QueryClient;

  const wrapper =
    () =>
    ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    supabaseFromMock.mockReset();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("aggregates project, services, and payments into summary", async () => {
    supabaseFromMock.mockImplementation((table: string) => {
      switch (table) {
        case "projects":
          return createSingleChain({ data: { base_price: 1000 }, error: null });
        case "project_services":
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() =>
                Promise.resolve({
                  data: [
                    {
                      quantity: 1,
                      unit_price_override: null,
                      vat_rate_override: null,
                      vat_mode_override: null,
                      services: {
                        selling_price: 400,
                        price: 350,
                        vat_rate: 0,
                        price_includes_vat: true,
                      },
                    },
                    {
                      quantity: 1,
                      unit_price_override: null,
                      vat_rate_override: null,
                      vat_mode_override: null,
                      services: {
                        selling_price: null,
                        price: 100,
                        vat_rate: 0,
                        price_includes_vat: true,
                      },
                    },
                  ],
                  error: null,
                })
              ),
            })),
          };
        case "payments":
          return createPaidPaymentsChain({
            data: [
              { amount: 500 },
              { amount: 150 },
            ],
            error: null,
          });
        default:
          throw new Error(`Unexpected table ${table}`);
      }
    });

    const { result } = renderHook(
      () => useProjectPayments("project-1"),
      { wrapper: wrapper() }
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.paymentSummary).toEqual({
      totalPaid: 650,
      totalProject: 1500,
      remaining: 850,
      currency: "TRY",
    });
  });

  it("falls back to zeroed summary when any request fails", async () => {
    supabaseFromMock.mockImplementation((table: string) => {
      if (table === "projects") {
        return createSingleChain({
          data: null,
          error: new Error("project fetch failed"),
        });
      }
      throw new Error(`Unexpected table ${table}`);
    });

    const { result } = renderHook(
      () => useProjectPayments("project-error"),
      { wrapper: wrapper() }
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.paymentSummary).toEqual({
      totalPaid: 0,
      totalProject: 0,
      remaining: 0,
      currency: "TRY",
    });
  });

  it("recomputes when refresh trigger changes and exposes refetch helper", async () => {
    const basePriceChain = [
      createSingleChain({ data: { base_price: 100 }, error: null }),
      createSingleChain({ data: { base_price: 200 }, error: null }),
    ];

    const paymentsChain = [
      createPaidPaymentsChain({
        data: [{ amount: 25 }],
        error: null,
      }),
      createPaidPaymentsChain({
        data: [{ amount: 50 }],
        error: null,
      }),
    ];

    supabaseFromMock.mockImplementation((table: string) => {
      switch (table) {
        case "projects":
          return basePriceChain.shift();
        case "project_services":
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() =>
                Promise.resolve({
                  data: [],
                  error: null,
                })
              ),
            })),
          };
        case "payments":
          return paymentsChain.shift();
        default:
          throw new Error(`Unexpected table ${table}`);
      }
    });

    const { result, rerender } = renderHook(
      ({ refresh }: { refresh?: number }) =>
        useProjectPayments("project-1", refresh),
      {
        wrapper: wrapper(),
        initialProps: { refresh: 1 },
      }
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.paymentSummary.totalProject).toBe(100);
    expect(result.current.paymentSummary.totalPaid).toBe(25);

    rerender({ refresh: 2 });

    await waitFor(() =>
      expect(result.current.paymentSummary.totalProject).toBe(200)
    );
    expect(result.current.paymentSummary.totalPaid).toBe(50);

    supabaseFromMock.mockClear();

    await act(async () => {
      await result.current.refetch();
    });

    expect(supabaseFromMock).toHaveBeenCalledWith("projects");
  });
});
