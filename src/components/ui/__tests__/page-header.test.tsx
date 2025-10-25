import { render, screen } from "@/utils/testUtils";
import {
  PageHeader,
  PageHeaderActions,
  PageHeaderSearch,
} from "../page-header";

describe("PageHeader", () => {
  it("renders sticky header with title, subtitle, and children", () => {
    const { container } = render(
      <PageHeader title="Dashboard" subtitle="Team overview" sticky>
        <PageHeaderSearch>
          <div>Search content</div>
        </PageHeaderSearch>
        <PageHeaderActions>
          <button type="button">Add item</button>
        </PageHeaderActions>
      </PageHeader>
    );

    const wrapper = container.querySelector(".max-w-full") as HTMLElement;
    expect(wrapper).toBeInTheDocument();
    expect(wrapper).toHaveClass("lg:sticky");
    expect(screen.getAllByText("Dashboard")).toHaveLength(2);
    expect(screen.getAllByText("Team overview")).toHaveLength(2);

    const searchContainer = screen.getAllByText("Search content")[0].parentElement;
    expect(searchContainer).toHaveClass("flex-1 w-full sm:max-w-lg");

    const actionsContainer = screen.getAllByText("Add item")[0].parentElement;
    expect(actionsContainer).toHaveClass("flex items-center gap-2 flex-shrink-0 w-full sm:w-auto sm:justify-end");
  });
});
