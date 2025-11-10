jest.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: jest.fn(),
  },
}));

jest.mock("@/lib/services/projectServiceRecords", () => ({
  fetchProjectServiceRecords: jest.fn(),
}));

jest.mock("@/hooks/useOrganizationData", () => ({
  useOrganizationTaxProfile: jest.fn(),
}));

import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { useProjectPayments } from "../useProjectPayments";
import { supabase } from "@/integrations/supabase/client";
import { fetchProjectServiceRecords } from "@/lib/services/projectServiceRecords";
import { useOrganizationTaxProfile } from "@/hooks/useOrganizationData";

const supabaseFromMock = supabase.from as jest.Mock;
const fetchProjectServiceRecordsMock = fetchProjectServiceRecords as jest.Mock;
const useOrganizationTaxProfileMock = useOrganizationTaxProfile as jest.Mock;

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
      eq: jest.fn((_columnB: string, _valueB: unknown) => ({
        eq: jest.fn(() => Promise.resolve(result)),
      })),
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
    fetchProjectServiceRecordsMock.mockReset();
    useOrganizationTaxProfileMock.mockReturnValue({ data: { vatExempt: false } });
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("aggregates project, services, and payments into summary", async () => {
    fetchProjectServiceRecordsMock.mockResolvedValue([
      {
        projectServiceId: "service-1",
        billingType: "extra",
        quantity: 1,
        overrides: { unitCost: null, unitPrice: null, vatMode: null, vatRate: null },
        service: {
          id: "svc-1",
          name: "Service 1",
          extra: true,
          selling_price: 400,
          price: 400,
          vat_rate: 0,
          price_includes_vat: true,
        },
      },
      {
        projectServiceId: "service-2",
        billingType: "extra",
        quantity: 1,
        overrides: { unitCost: null, unitPrice: null, vatMode: null, vatRate: null },
        service: {
          id: "svc-2",
          name: "Service 2",
          extra: true,
          selling_price: 100,
          price: 100,
          vat_rate: 0,
          price_includes_vat: true,
        },
      },
      {
        projectServiceId: "service-3",
        billingType: "included",
        quantity: 1,
        overrides: { unitCost: null, unitPrice: null, vatMode: null, vatRate: null },
        service: {
          id: "svc-3",
          name: "Service 3",
          extra: false,
          selling_price: 50,
          price: 50,
          vat_rate: 0,
          price_includes_vat: true,
        },
      },
    ]);

    supabaseFromMock.mockImplementation((table: string) => {
      switch (table) {
        case "projects":
          return createSingleChain({ data: { base_price: 1000 }, error: null });
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

  it("omits VAT when organization is VAT exempt", async () => {
    useOrganizationTaxProfileMock.mockReturnValue({ data: { vatExempt: true } });
    fetchProjectServiceRecordsMock.mockResolvedValue([
      {
        projectServiceId: "service-vat",
        billingType: "extra",
        quantity: 1,
        overrides: { unitCost: null, unitPrice: null, vatMode: null, vatRate: null },
        service: {
          id: "svc-vat",
          name: "VAT Service",
          extra: true,
          selling_price: 100,
          price: 100,
          vat_rate: 20,
          price_includes_vat: false,
        },
      },
    ]);

    supabaseFromMock.mockImplementation((table: string) => {
      switch (table) {
        case "projects":
          return createSingleChain({ data: { base_price: 0 }, error: null });
        case "payments":
          return createPaidPaymentsChain({ data: [], error: null });
        default:
          throw new Error(`Unexpected table ${table}`);
      }
    });

    const { result } = renderHook(() => useProjectPayments("project-vat"), {
      wrapper: wrapper(),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.paymentSummary).toEqual({
      totalPaid: 0,
      totalProject: 100,
      remaining: 100,
      currency: "TRY",
    });
  });

  it("falls back to zeroed summary when any request fails", async () => {
    fetchProjectServiceRecordsMock.mockRejectedValue(new Error("project fetch failed"));

    supabaseFromMock.mockImplementation((table: string) => {
      switch (table) {
        case "projects":
          return createSingleChain({
            data: null,
            error: new Error("project fetch failed"),
          });
        case "payments":
          return createPaidPaymentsChain({ data: [], error: null });
        default:
          throw new Error(`Unexpected table ${table}`);
      }
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

    fetchProjectServiceRecordsMock.mockResolvedValue([]);

    supabaseFromMock.mockImplementation((table: string) => {
      switch (table) {
        case "projects":
          return basePriceChain.shift();
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

    const refetchBase = createSingleChain({ data: { base_price: 200 }, error: null });
    const refetchPayments = createPaidPaymentsChain({
      data: [{ amount: 50 }],
      error: null,
    });

    supabaseFromMock.mockImplementation((table: string) => {
      switch (table) {
        case "projects":
          return refetchBase;
        case "payments":
          return refetchPayments;
        default:
          throw new Error(`Unexpected table ${table}`);
      }
    });

    await act(async () => {
      await result.current.refetch();
    });

    expect(supabaseFromMock).toHaveBeenCalledWith("projects");
  });
});
