import { render, screen } from "@/utils/testUtils";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../card";

describe("Card primitives", () => {
  it("renders composed sections with default classes", () => {
    const { container } = render(
      <Card className="custom-card">
        <CardHeader className="header-extra">
          <CardTitle>Card Title</CardTitle>
          <CardDescription>Description text</CardDescription>
        </CardHeader>
        <CardContent className="content-extra">Content body</CardContent>
        <CardFooter className="footer-extra">
          <span>Footer info</span>
        </CardFooter>
      </Card>
    );

    const card = container.querySelector(".custom-card") as HTMLElement;
    expect(card).toHaveClass("rounded-lg", "border");
    expect(screen.getByText("Card Title")).toHaveClass(
      "text-2xl",
      "font-semibold"
    );
    expect(screen.getByText("Description text")).toHaveClass(
      "text-sm",
      "text-muted-foreground"
    );
    const content = container.querySelector(".content-extra") as HTMLElement;
    expect(content).toBeInTheDocument();
    expect(content).toHaveTextContent("Content body");

    const footer = container.querySelector(".footer-extra") as HTMLElement;
    expect(footer).toBeInTheDocument();
    expect(footer).toHaveTextContent("Footer info");
  });
});
