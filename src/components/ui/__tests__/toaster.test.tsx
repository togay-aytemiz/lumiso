import { render, screen } from "@/utils/testUtils";
import { Toaster } from "../toaster";
import { useToast } from "@/hooks/use-toast";

jest.mock("@/hooks/use-toast", () => ({
  useToast: jest.fn(),
}));

describe("Toaster", () => {
  beforeEach(() => {
    (useToast as jest.Mock).mockReturnValue({
      toasts: [],
    });
  });

  it("renders toast items with their titles, descriptions, and actions", () => {
    (useToast as jest.Mock).mockReturnValue({
      toasts: [
        {
          id: "1",
          title: "Update ready",
          description: "Install the latest build",
          action: <button type="button">Retry</button>,
        },
        {
          id: "2",
          description: "Background sync complete",
        },
      ],
    });

    const { container } = render(<Toaster />);

    expect(screen.getByText("Update ready")).toBeInTheDocument();
    expect(screen.getByText("Install the latest build")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(screen.getByText("Background sync complete")).toBeInTheDocument();

    const closeButtons = container.querySelectorAll('[toast-close]');
    expect(closeButtons).toHaveLength(2);
  });

  it("always mounts the toast viewport for accessibility", () => {
    render(<Toaster />);

    expect(
      screen.getByRole("region", { name: /notifications/i })
    ).toBeInTheDocument();
  });
});
