import { fireEvent, render, screen } from "@/utils/testUtils";
import { DataTable } from "../data-table";
import { useTranslation } from "react-i18next";

type Person = { name: string };

jest.mock("react-i18next", () => ({
  useTranslation: jest.fn(),
}));

describe("DataTable", () => {
  const renderTable = (override?: Partial<Parameters<typeof DataTable>[0]>) => {
    const columns = [
      {
        key: "name",
        header: "Name",
        sortable: true,
      },
    ];

    const data: Person[] = [
      { name: "Zed" },
      { name: "Ada" },
      { name: "Mike" },
    ];

    return render(
      <DataTable<Person>
        data={data}
        columns={columns}
        itemsPerPage={2}
        {...override}
      />
    );
  };

  beforeEach(() => {
    (useTranslation as jest.Mock).mockReturnValue({
      t: (key: string, options?: Record<string, number>) => {
        if (key === "labels.showing_results" && options) {
          return `Showing ${options.start}-${options.end} of ${options.total}`;
        }
        if (key === "table.noDataAvailable") {
          return "No data available";
        }
        if (key === "buttons.previous") {
          return "Previous";
        }
        if (key === "buttons.next") {
          return "Next";
        }
        return key;
      },
    });
  });

  it("renders rows and updates pagination info when changing pages", () => {
    renderTable();

    expect(screen.getByText("Showing 1-2 of 3")).toBeInTheDocument();

    let bodyCells = screen.getAllByRole("cell");
    expect(bodyCells[0]).toHaveTextContent("Zed");
    expect(bodyCells[1]).toHaveTextContent("Ada");

    const pageTwo = screen.getByText("2");
    fireEvent.click(pageTwo.closest("a") ?? pageTwo);

    expect(screen.getByText("Showing 3-3 of 3")).toBeInTheDocument();

    bodyCells = screen.getAllByRole("cell");
    expect(bodyCells).toHaveLength(1);
    expect(bodyCells[0]).toHaveTextContent("Mike");
  });

  it("supports sorting toggles for sortable columns", () => {
    renderTable();

    const header = screen.getByRole("columnheader", { name: /Name/ });

    fireEvent.click(header);

    let bodyCells = screen.getAllByRole("cell");
    expect(bodyCells[0]).toHaveTextContent("Ada");
    expect(bodyCells[1]).toHaveTextContent("Mike");

    fireEvent.click(header);
    bodyCells = screen.getAllByRole("cell");
    expect(bodyCells[0]).toHaveTextContent("Zed");
    expect(bodyCells[1]).toHaveTextContent("Mike");
  });

  it("renders default empty state when no data is provided", () => {
    renderTable({ data: [] });

    expect(screen.queryByRole("cell", { name: "-" })).not.toBeInTheDocument();
    expect(screen.getByText("No data available")).toBeInTheDocument();
  });

  it("fires row click callback when provided", () => {
    const onRowClick = jest.fn();
    renderTable({ onRowClick });

    fireEvent.click(screen.getAllByRole("row")[1]);

    expect(onRowClick).toHaveBeenCalledWith({ name: "Zed" });
  });
});
