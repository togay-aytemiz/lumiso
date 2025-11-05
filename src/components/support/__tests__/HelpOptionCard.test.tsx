import { fireEvent, render, screen } from "@/utils/testUtils";
import { HelpOptionCard } from "../HelpOptionCard";
import type { Icon } from "lucide-react";

describe("HelpOptionCard", () => {
  const icon: Icon = ({ className, ...rest }) => (
    <svg data-testid="help-icon" className={className} {...rest} />
  );

  it("renders title, description, and icon while invoking onSelect", () => {
    const onSelect = jest.fn();

    render(
      <HelpOptionCard
        icon={icon}
        title="Documentation"
        description="Agent handbook"
        onSelect={onSelect}
      />
    );

    expect(screen.getByText("Documentation")).toBeInTheDocument();
    expect(screen.getByText("Agent handbook")).toBeInTheDocument();
    expect(screen.getByTestId("help-icon")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /documentation/i }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("disables interaction when disabled prop is true", () => {
    const onSelect = jest.fn();

    render(
      <HelpOptionCard
        icon={icon}
        title="Contact Support"
        description="Drop us a line"
        onSelect={onSelect}
        disabled
      />
    );

    const button = screen.getByRole("button", { name: /contact support/i });
    expect(button).toBeDisabled();

    fireEvent.click(button);
    expect(onSelect).not.toHaveBeenCalled();
  });
});
