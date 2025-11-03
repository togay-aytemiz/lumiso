import React from "react";
import { render, screen } from "@/utils/testUtils";
import { ServicesTableCard, type ServicesTableRow } from "../ServicesTableCard";

const rows: ServicesTableRow[] = [
  {
    id: "row-1",
    name: "Videographer",
    vendor: "Kemal",
    quantity: 3,
    unitPrice: 5000,
    lineTotal: 15000,
  },
  {
    id: "row-2",
    name: "Fine Art Album",
    vendor: null,
    quantity: 2,
    unitPrice: 1200,
    lineTotal: 2400,
    isCustom: true,
  },
];

const labels = {
  columns: {
    name: "Service",
    vendor: "Vendor",
    quantity: "Qty",
    unitPrice: "Unit price",
    lineTotal: "Line total",
  },
  totals: {
    cost: "Cost total",
    price: "Price total",
    vat: "VAT total",
    total: "Total",
    margin: "Margin",
  },
  customTag: "Custom item",
  customVendorFallback: "—",
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 0,
  }).format(value);

describe("ServicesTableCard", () => {
  it("renders rows, totals, and custom indicators", () => {
    render(
      <ServicesTableCard
        rows={rows}
        totals={{ cost: 4000, price: 17400, vat: 2400, total: 19800, margin: 13400 }}
        labels={labels}
        emptyMessage="No services"
        formatCurrency={formatCurrency}
      />
    );

    expect(screen.getByText("Videographer")).toBeInTheDocument();
    expect(screen.getByText("Kemal")).toBeInTheDocument();
    expect(screen.getByText("Fine Art Album")).toBeInTheDocument();
    expect(screen.getByText("Custom item")).toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(1);

    expect(screen.getByText("₺5.000")).toBeInTheDocument();
    expect(screen.getByText("₺15.000")).toBeInTheDocument();
    expect(screen.getByText("₺1.200")).toBeInTheDocument();

    const costMetric = screen.getByText("Cost total").closest("div");
    expect(costMetric).toHaveTextContent("₺4.000");

    const priceMetric = screen.getByText("Price total").closest("div");
    expect(priceMetric).toHaveTextContent("₺17.400");

    const vatMetric = screen.getByText("VAT total").closest("div");
    expect(vatMetric).toHaveTextContent("₺2.400");

    const totalMetric = screen.getByText("Total").closest("div");
    expect(totalMetric).toHaveTextContent("₺19.800");

    const marginValue = screen.getByText("₺13.400");
    expect(marginValue.parentElement).toHaveClass("text-emerald-600");
  });

  it("shows empty message when there are no rows", () => {
    render(
      <ServicesTableCard
        rows={[]}
        labels={labels}
        emptyMessage="Nothing selected"
        formatCurrency={formatCurrency}
      />
    );

    expect(screen.getByText("Nothing selected")).toBeInTheDocument();
    expect(screen.queryByText("Service")).not.toBeInTheDocument();
  });
});
