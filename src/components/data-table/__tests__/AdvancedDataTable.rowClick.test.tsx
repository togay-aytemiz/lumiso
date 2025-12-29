import React from "react";
import { fireEvent, render, screen } from "@/utils/testUtils";
import { AdvancedDataTable } from "../AdvancedDataTable";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

describe("AdvancedDataTable row click handling", () => {
  it("ignores row clicks triggered from interactive elements", () => {
    const onRowClick = jest.fn();
    const rows = [{ id: "1", name: "Alpha" }];

    render(
      <AdvancedDataTable
        data={rows}
        columns={[
          { id: "name", label: "Name", accessorKey: "name" },
          {
            id: "action",
            label: "Action",
            render: () => (
              <button type="button">
                Action
              </button>
            ),
          },
        ]}
        rowKey={(row) => row.id}
        onRowClick={onRowClick}
      />
    );

    fireEvent.click(screen.getByText("Alpha"));
    expect(onRowClick).toHaveBeenCalledWith(rows[0]);

    onRowClick.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Action" }));
    expect(onRowClick).not.toHaveBeenCalled();
  });
});

