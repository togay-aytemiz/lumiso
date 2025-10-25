import { render, screen } from "@/utils/testUtils";
import { DataTableContainer } from "../data-table-container";

describe("DataTableContainer", () => {
  it("applies base styling and renders children", () => {
    render(
      <DataTableContainer className="custom-wrapper">
        <div data-testid="inner">content</div>
      </DataTableContainer>
    );

    const inner = screen.getByTestId("inner").parentElement as HTMLElement;
    const outer = inner.parentElement as HTMLElement;

    expect(outer.className).toContain("data-table-container");
    expect(outer.className).toContain("w-full");
    expect(outer.className).toContain("custom-wrapper");

    expect(inner.className).toContain("min-w-full");
    expect(inner.className).toContain("md:min-w-max");
  });
});
