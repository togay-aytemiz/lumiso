import { act, renderHook } from "@testing-library/react";
import React from "react";
import { useDataTable } from "../useDataTable";

type Item = {
  id: number;
  name: string;
  details: {
    score: number;
    date: string;
  };
};

const data: Item[] = [
  { id: 1, name: "Charlie", details: { score: 10, date: "2024-01-02" } },
  { id: 2, name: "Alice", details: { score: 30, date: "2024-01-01" } },
  { id: 3, name: "Bob", details: { score: 20, date: "2024-01-03" } },
];

const columns = [
  { key: "name", header: "Name", sortable: true, filterable: true },
  { key: "details.score", header: "Score", sortable: true },
  {
    key: "details.date",
    header: "Date",
    sortable: true,
    accessor: (item: Item) => new Date(item.details.date),
  },
];

describe("useDataTable", () => {
  it("sorts by column accessor and toggles direction", () => {
    const { result } = renderHook(() => useDataTable<Item>({ data, columns }));

    act(() => {
      result.current.handleSort("name");
    });
    expect(result.current.filteredAndSortedData.map((row) => row.name)).toEqual([
      "Alice",
      "Bob",
      "Charlie",
    ]);

    act(() => {
      result.current.handleSort("name");
    });
    expect(result.current.filteredAndSortedData.map((row) => row.name)).toEqual([
      "Charlie",
      "Bob",
      "Alice",
    ]);

    act(() => {
      result.current.handleSort("details.date");
    });
    expect(result.current.filteredAndSortedData.map((row) => row.id)).toEqual([2, 1, 3]);
  });

  it("filters using dotted keys and resets pagination", () => {
    const { result } = renderHook(() =>
      useDataTable<Item>({ data, columns, itemsPerPage: 1 })
    );

    expect(result.current.totalPages).toBe(3);

    act(() => {
      result.current.handlePageChange(2);
    });
    expect(result.current.currentPage).toBe(2);

    act(() => {
      result.current.handleFilter("name", "a");
    });

    expect(result.current.currentPage).toBe(1);
    expect(result.current.totalItems).toBe(2);
    expect(result.current.filteredAndSortedData.map((row) => row.name)).toEqual([
      "Alice",
      "Charlie",
    ]);
  });

  it("resets filters and calculates pagination metadata", () => {
    const { result } = renderHook(() =>
      useDataTable<Item>({ data, columns, itemsPerPage: 2 })
    );

    expect(result.current.paginatedData).toHaveLength(2);
    expect(result.current.endIndex).toBe(2);

    act(() => {
      result.current.handleFilter("name", "bob");
    });
    expect(result.current.totalItems).toBe(1);
    expect(result.current.totalPages).toBe(1);

    act(() => {
      result.current.resetFilters();
    });

    expect(result.current.totalItems).toBe(3);
    expect(result.current.totalPages).toBe(2);
    expect(result.current.filters).toEqual({});
  });
});
