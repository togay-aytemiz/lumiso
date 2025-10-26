import { fireEvent, render, screen } from "@/utils/testUtils";
import { TableSearchInput } from "../TableSearchInput";

describe("TableSearchInput", () => {
  it("renders search input and fires onChange", () => {
    const handleChange = jest.fn();
    render(
      <TableSearchInput
        value=""
        onChange={handleChange}
        placeholder="Search rows"
        clearAriaLabel="Clear search"
      />
    );

    fireEvent.change(screen.getByLabelText("Search rows"), {
      target: { value: "alpha" },
    });
    expect(handleChange).toHaveBeenCalledWith("alpha");
  });

  it("shows loading indicator and clear button", () => {
    const handleClear = jest.fn();
    const { rerender } = render(
      <TableSearchInput
        value="ready"
        onChange={jest.fn()}
        placeholder="Search rows"
        loading
        onClear={handleClear}
        clearAriaLabel="Clear search"
      />
    );

    expect(screen.queryByLabelText("Clear search")).toBeNull();
    expect(
      document.querySelector("[class*='animate-spin']")
    ).toBeInTheDocument();

    rerender(
      <TableSearchInput
        value="ready"
        onChange={jest.fn()}
        placeholder="Search rows"
        loading={false}
        onClear={handleClear}
        clearAriaLabel="Clear search"
      />
    );

    fireEvent.click(screen.getByLabelText("Clear search"));
    expect(handleClear).toHaveBeenCalledTimes(1);
  });
});
