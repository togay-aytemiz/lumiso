import { render, screen } from "@testing-library/react";

import { Button } from "@/components/ui/button";
import { IconActionButton } from "@/components/ui/icon-action-button";

describe("touch target sizing", () => {
  it("defaults small Button sizes to compact touch targets", () => {
    const { rerender } = render(
      <Button type="button" size="icon">
        Icon
      </Button>
    );

    expect(screen.getByRole("button", { name: "Icon" })).toHaveAttribute(
      "data-touch-target",
      "compact"
    );

    rerender(
      <Button type="button" size="sm">
        Small
      </Button>
    );

    expect(screen.getByRole("button", { name: "Small" })).toHaveAttribute(
      "data-touch-target",
      "compact"
    );
  });

  it("allows opting out of compact touch targets", () => {
    render(
      <Button type="button" size="icon" touchTarget="default">
        Icon
      </Button>
    );

    expect(screen.getByRole("button", { name: "Icon" })).not.toHaveAttribute(
      "data-touch-target"
    );
  });

  it("defaults IconActionButton to compact touch targets", () => {
    render(
      <IconActionButton aria-label="Edit">
        E
      </IconActionButton>
    );

    expect(screen.getByRole("button", { name: "Edit" })).toHaveAttribute(
      "data-touch-target",
      "compact"
    );
  });
});

