import { fireEvent, render, renderHook } from "@testing-library/react";

const translationMock = (key: string) => key;
jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: translationMock,
  }),
}));

jest.mock("@/lib/utils", () => {
  const actual = jest.requireActual("@/lib/utils");
  return {
    ...actual,
    formatDate: jest.fn(() => "formatted-date"),
  };
});

import type { Payment } from "../../types";
import { usePaymentsTableColumns } from "../usePaymentsTableColumns";
import { PAYMENT_COLORS } from "@/lib/paymentColors";

const { formatDate } = jest.requireMock("@/lib/utils") as { formatDate: jest.Mock };

describe("usePaymentsTableColumns", () => {
  const baseRow: Payment = {
    id: "payment-1",
    amount: 150,
    date_paid: "2024-05-10T00:00:00Z",
    status: "paid",
    description: "Deposit",
    type: "balance_due",
    project_id: "project-1",
    created_at: "2024-05-01T00:00:00Z",
    updated_at: "2024-05-02T00:00:00Z",
    entry_kind: "recorded",
    scheduled_initial_amount: null,
    scheduled_remaining_amount: null,
    projects: {
      id: "project-1",
      name: "Aurora",
      base_price: 150,
      lead_id: "lead-1",
      status_id: null,
      previous_status_id: null,
      project_type_id: null,
      description: null,
      updated_at: undefined,
      created_at: undefined,
      user_id: undefined,
      leads: { id: "lead-1", name: "Lead Name" },
    },
  };

  it("provides stable column definitions for identical handlers", () => {
    const handlers = {
      onProjectSelect: jest.fn(),
      onNavigateToLead: jest.fn(),
      formatAmount: jest.fn((value: number) => `$${value.toFixed(2)}`),
    };

    const { result, rerender } = renderHook(
      (props: typeof handlers) =>
        usePaymentsTableColumns({
          onProjectSelect: props.onProjectSelect,
          onNavigateToLead: props.onNavigateToLead,
          formatAmount: props.formatAmount,
        }),
      {
        initialProps: handlers,
      }
    );

    const initialColumns = result.current;
    expect(initialColumns).toHaveLength(7);
    expect(initialColumns.map((column) => column.id)).toEqual([
      "date_paid",
      "lead",
      "project",
      "amount",
      "description",
      "status",
      "type",
    ]);

    rerender(handlers);
    expect(result.current).toBe(initialColumns);

    const nextHandlers = {
      ...handlers,
      formatAmount: jest.fn((value: number) => `€${value.toFixed(2)}`),
    };

    rerender(nextHandlers);
    expect(result.current).not.toBe(initialColumns);
  });

  it("renders project and lead cells with interactive handlers", () => {
    const onProjectSelect = jest.fn();
    const onNavigateToLead = jest.fn();
    const formatAmount = jest.fn((value: number) => `$${value}`);

    const { result } = renderHook(() =>
      usePaymentsTableColumns({ onProjectSelect, onNavigateToLead, formatAmount })
    );

    const columns = result.current;
    const leadColumn = columns.find((column) => column.id === "lead");
    const projectColumn = columns.find((column) => column.id === "project");
    const amountColumn = columns.find((column) => column.id === "amount");

    const leadView = render(leadColumn!.render(baseRow));
    fireEvent.click(leadView.getByRole("button", { name: "Lead Name" }));
    expect(onNavigateToLead).toHaveBeenCalledWith("lead-1");
    leadView.unmount();

    const projectView = render(projectColumn!.render(baseRow));
    fireEvent.click(projectView.getByRole("button", { name: "Aurora" }));
    expect(onProjectSelect).toHaveBeenCalledWith(baseRow);
    projectView.unmount();

    const emptyProjectView = render(projectColumn!.render({ ...baseRow, projects: null }));
    expect(emptyProjectView.getByText("-")).toBeInTheDocument();
    emptyProjectView.unmount();

    const emptyLeadView = render(leadColumn!.render({ ...baseRow, projects: null }));
    expect(emptyLeadView.getByText("-")).toBeInTheDocument();
    emptyLeadView.unmount();

    const amountView = render(amountColumn!.render(baseRow));
    expect(formatAmount).toHaveBeenCalledWith(150);
    expect(amountView.getByText("$150")).toBeInTheDocument();
    amountView.unmount();

    formatAmount.mockClear();
    const refundAmountView = render(amountColumn!.render({ ...baseRow, amount: -75 }));
    expect(formatAmount).toHaveBeenCalledWith(75);
    expect(refundAmountView.getByText("-$75")).toBeInTheDocument();
    refundAmountView.unmount();

    formatAmount.mockClear();
    const scheduledAmountView = render(
      amountColumn!.render({
        ...baseRow,
        entry_kind: "scheduled",
        amount: 5000,
        scheduled_initial_amount: 5000,
        scheduled_remaining_amount: 3200,
      })
    );
    expect(formatAmount).toHaveBeenCalledWith(3200);
    expect(scheduledAmountView.getByText("$3200")).toBeInTheDocument();
    scheduledAmountView.unmount();
  });

  it("formats dates and statuses while applying payment colors", () => {
    const onProjectSelect = jest.fn();
    const onNavigateToLead = jest.fn();
    const formatAmount = jest.fn((value: number) => `$${value}`);

    const { result } = renderHook(() =>
      usePaymentsTableColumns({ onProjectSelect, onNavigateToLead, formatAmount })
    );

    const columns = result.current;
    const dateColumn = columns.find((column) => column.id === "date_paid");
    const statusColumn = columns.find((column) => column.id === "status");
    const typeColumn = columns.find((column) => column.id === "type");

    formatDate.mockClear();
    const paidDateView = render(dateColumn!.render(baseRow));
    expect(formatDate).toHaveBeenCalledWith("2024-05-10T00:00:00Z");
    expect(paidDateView.getByText("formatted-date")).toBeInTheDocument();
    paidDateView.unmount();

    const createdDateView = render(dateColumn!.render({ ...baseRow, date_paid: null }));
    expect(formatDate).toHaveBeenCalledWith("2024-05-01T00:00:00Z");
    createdDateView.unmount();

    const paidStatusView = render(statusColumn!.render(baseRow));
    const paidBadge = paidStatusView.getByText("payments.status.paid");
    PAYMENT_COLORS.paid.badgeClass.split(" ").forEach((className) => {
      expect(paidBadge).toHaveClass(className);
    });
    paidStatusView.unmount();

    const dueStatusView = render(statusColumn!.render({ ...baseRow, status: "due" }));
    const dueBadge = dueStatusView.getByText("payments.status.due");
    PAYMENT_COLORS.due.badgeClass.split(" ").forEach((className) => {
      expect(dueBadge).toHaveClass(className);
    });
    dueStatusView.unmount();

    const refundStatusView = render(statusColumn!.render({ ...baseRow, amount: -50 }));
    const refundBadge = refundStatusView.getByText("payments.refund.badge");
    PAYMENT_COLORS.refund.badgeClass.split(" ").forEach((className) => {
      expect(refundBadge).toHaveClass(className);
    });
    refundStatusView.unmount();

    const balanceTypeView = render(typeColumn!.render(baseRow));
    expect(balanceTypeView.getByText("payments.type.balance")).toBeInTheDocument();
    balanceTypeView.unmount();

    const depositTypeView = render(typeColumn!.render({ ...baseRow, type: "deposit_payment" }));
    expect(depositTypeView.getByText("payments.type.deposit")).toBeInTheDocument();
    depositTypeView.unmount();

    const manualTypeView = render(typeColumn!.render({ ...baseRow, type: "manual" }));
    expect(manualTypeView.getByText("payments.type.manual")).toBeInTheDocument();
    manualTypeView.unmount();

    const scheduledTypeView = render(
      typeColumn!.render({ ...baseRow, entry_kind: "scheduled" })
    );
    expect(scheduledTypeView.getByText("payments.type.scheduled")).toBeInTheDocument();
    scheduledTypeView.unmount();
  });
});
