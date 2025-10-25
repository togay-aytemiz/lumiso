import { render, screen } from "@/utils/testUtils";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "../pagination";
import { useTranslation } from "react-i18next";

jest.mock("react-i18next", () => ({
  useTranslation: jest.fn(),
}));

describe("Pagination primitives", () => {
  beforeEach(() => {
    (useTranslation as jest.Mock).mockReturnValue({
      t: (key: string) => key,
    });
  });

  it("renders navigation structure with active link", () => {
    render(
      <Pagination data-testid="pagination-root">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious href="#previous" />
          </PaginationItem>
          <PaginationItem>
            <PaginationLink href="#1" isActive>
              1
            </PaginationLink>
          </PaginationItem>
          <PaginationItem>
            <PaginationEllipsis />
          </PaginationItem>
          <PaginationItem>
            <PaginationNext href="#next" />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    );

    expect(
      screen.getByRole("navigation", { name: "pagination" })
    ).toBeInTheDocument();

    expect(screen.getByRole("link", { name: "1" })).toHaveAttribute(
      "aria-current",
      "page"
    );

    expect(
      screen.getByRole("link", { name: "pagination.previousPage" })
    ).toHaveAttribute("href", "#previous");
    expect(
      screen.getByRole("link", { name: "pagination.nextPage" })
    ).toHaveAttribute(
      "href",
      "#next"
    );

    expect(
      screen.getByText("pagination.morePages").parentElement
    ).toHaveAttribute("aria-hidden", "true");
  });
});
