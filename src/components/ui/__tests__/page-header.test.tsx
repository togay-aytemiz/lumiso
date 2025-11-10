import { render, screen } from "@/utils/testUtils";
import {
  PageHeader,
  PageHeaderActions,
  PageHeaderSearch,
} from "../page-header";

jest.mock("@/components/UserMenu", () => ({
  UserMenu: () => <div data-testid="user-menu" />,
}));

describe("PageHeader", () => {
  it("renders sticky header with title and layout components", () => {
    const { container } = render(
      <PageHeader title="Dashboard" sticky>
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
    expect(screen.queryByText("Team overview")).not.toBeInTheDocument();

    const searchContainer = screen.getAllByText("Search content")[0].parentElement;
    expect(searchContainer).toHaveClass("flex-1 min-w-0 w-full");

    const actionsContainer = screen.getAllByText("Add item")[0].parentElement;
    expect(actionsContainer).toHaveClass(
      "flex items-center gap-2 flex-shrink-0 w-full sm:w-auto sm:justify-end lg:justify-start"
    );

    expect(screen.getByTestId("user-menu")).toBeInTheDocument();
  });
});
