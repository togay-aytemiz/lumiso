import React from "react";
import userEvent from "@testing-library/user-event";
import { fireEvent, render, screen, within } from "@/utils/testUtils";
import {
  ServiceInventorySelector,
  type ServiceInventoryItem,
  type ServiceInventoryLabels,
} from "../ServiceInventorySelector";

const buildLabels = (overrides: Partial<ServiceInventoryLabels> = {}): ServiceInventoryLabels => ({
  typeMeta: {
    coverage: {
      title: "Crew services",
      subtitle: "People-based",
    },
    deliverable: {
      title: "Deliverables",
      subtitle: "Client handoffs",
    },
    unknown: {
      title: "Other services",
      subtitle: "No type yet",
    },
  },
  add: "Add",
  decrease: "Decrease",
  increase: "Increase",
  remove: "Remove",
  vendor: "Vendor",
  unitCost: "Unit cost",
  unitPrice: "Unit price",
  uncategorized: "Other",
  inactive: "Inactive",
  empty: "Empty inventory",
  quantity: "Quantity",
  selectedTag: (selected, total) => `${selected}/${total} selected`,
  quantityTag: (count) => `Quantity: ${count}`,
  retry: "Retry",
  ...overrides,
});

const services: ServiceInventoryItem[] = [
  {
    id: "photographer",
    name: "Photographer",
    category: "Crew",
    serviceType: "coverage",
    vendorName: "Kemal",
    unitCost: 500,
    unitPrice: 1500,
    isActive: true,
  },
  {
    id: "assistant",
    name: "Assistant",
    category: "Crew",
    serviceType: "coverage",
    vendorName: null,
    unitCost: 250,
    unitPrice: 600,
    isActive: true,
  },
  {
    id: "lighting",
    name: "Lighting Kit",
    category: "Equipment",
    serviceType: "coverage",
    vendorName: null,
    unitCost: 100,
    unitPrice: 250,
    isActive: true,
  },
  {
    id: "album",
    name: "Photo Album",
    category: "Albums",
    serviceType: "deliverable",
    vendorName: "AlbumCo",
    unitCost: 400,
    unitPrice: 900,
    isActive: true,
  },
];

describe.skip("ServiceInventorySelector", () => {
  it("collapses multi-category groups by default and expands on click", async () => {
    const user = userEvent.setup();
    render(
      <ServiceInventorySelector
        services={services}
        selected={{ photographer: 1, assistant: 2 }}
        labels={buildLabels()}
        onAdd={jest.fn()}
        onIncrease={jest.fn()}
        onDecrease={jest.fn()}
        onSetQuantity={jest.fn()}
        onRemove={jest.fn()}
      />
    );

    const crewTrigger = screen
      .getAllByRole("button", { name: /Crew/i })
      .find((button) => button.textContent?.includes("Quantity"));
    expect(crewTrigger).toBeTruthy();

    expect(crewTrigger).toHaveAttribute("data-state", "closed");

    await user.click(crewTrigger as HTMLElement);
    expect(crewTrigger).toHaveAttribute("data-state", "open");
    expect(screen.getByText("Photographer")).toBeInTheDocument();
    expect(screen.getByText("Assistant")).toBeInTheDocument();

    const deliverablesSegment = screen.getByRole("button", { name: /Deliverables/i });
    await user.click(deliverablesSegment);

    const deliverableTrigger = screen.getByRole("button", { name: /Albums/i });
    expect(deliverableTrigger).toHaveAttribute("data-state", "open");
    expect(screen.getByText("Photo Album")).toBeInTheDocument();
  });

  it("disables decrement at quantity 1 and allows manual quantity entry", async () => {
    const user = userEvent.setup();
    const handleSetQuantity = jest.fn();

    render(
      <ServiceInventorySelector
        services={services}
        selected={{ photographer: 1, assistant: 2 }}
        labels={buildLabels()}
        onAdd={jest.fn()}
        onIncrease={jest.fn()}
        onDecrease={jest.fn()}
        onSetQuantity={handleSetQuantity}
        onRemove={jest.fn()}
      />
    );

    const crewTrigger = screen
      .getAllByRole("button", { name: /Crew/i })
      .find((button) => button.textContent?.includes("Quantity"));
    expect(crewTrigger).toBeTruthy();
    await user.click(crewTrigger as HTMLElement);

    const photographerRow = screen.getByText("Photographer").closest("div[data-selected]");
    const assistantRow = screen.getByText("Assistant").closest("div[data-selected]");
    expect(photographerRow).toBeInTheDocument();
    expect(assistantRow).toBeInTheDocument();

    const decreaseButton = within(photographerRow as HTMLElement).getByRole("button", {
      name: /Decrease/i,
    });
    expect(decreaseButton).toBeDisabled();

    const quantityInput = within(assistantRow as HTMLElement).getByLabelText("Quantity");
    fireEvent.change(quantityInput, { target: { value: "5" } });

    expect(handleSetQuantity).toHaveBeenLastCalledWith("assistant", 5);
  });

  it("invokes callbacks when adding new services and switching types", async () => {
    const user = userEvent.setup();
    const handleAdd = jest.fn();

    render(
      <ServiceInventorySelector
        services={services}
        selected={{ photographer: 1 }}
        labels={buildLabels()}
        onAdd={handleAdd}
        onIncrease={jest.fn()}
        onDecrease={jest.fn()}
        onSetQuantity={jest.fn()}
        onRemove={jest.fn()}
      />
    );

    const equipmentTrigger = screen
      .getAllByRole("button", { name: /Equipment/i })
      .find((button) => button.textContent?.includes("Quantity"));
    expect(equipmentTrigger).toBeTruthy();
    await user.click(equipmentTrigger as HTMLElement);
    const lightingLabel = screen.getByText("Lighting Kit");
    let rowElement: HTMLElement | null = lightingLabel as HTMLElement;
    while (rowElement && !rowElement.querySelector("[aria-label='Add']")) {
      rowElement = rowElement.parentElement as HTMLElement | null;
    }

    expect(rowElement).not.toBeNull();

    const addButton = within(rowElement as HTMLElement).getByLabelText("Add");
    await user.click(addButton);
    expect(handleAdd).toHaveBeenCalledWith("lighting");

    const deliverablesSegment = screen.getByRole("button", { name: /Deliverables/ });
    await user.click(deliverablesSegment);
    expect(screen.getByText("Photo Album")).toBeInTheDocument();
  });
});
