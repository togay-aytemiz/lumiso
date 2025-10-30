import { render, screen } from "@/utils/testUtils";
import {
  Toast,
  ToastAction,
  ToastClose,
  ToastDescription,
  ToastProgress,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "../toast";

describe("Toast primitives", () => {
  it("renders the viewport with provided class names", async () => {
    render(
      <ToastProvider>
        <ToastViewport className="custom-viewport" />
      </ToastProvider>
    );

    const region = await screen.findByRole("region", {
      name: /notifications/i,
    });
    const viewport = region.querySelector("ol") as HTMLElement | null;
    expect(viewport).toBeInTheDocument();
    expect(viewport).toHaveClass("custom-viewport");
  });

  it("applies variant styling and exposes close/action primitives", () => {
    const { rerender } = render(
      <ToastProvider>
        <Toast open data-testid="toast" onOpenChange={() => {}}>
          <ToastTitle>Heads up</ToastTitle>
          <ToastDescription>All good!</ToastDescription>
          <ToastAction altText="Undo">Undo</ToastAction>
          <ToastClose data-testid="close" />
        </Toast>
        <ToastViewport />
      </ToastProvider>
    );

    const toast = screen.getByTestId("toast");
    expect(toast.className).toContain("border bg-background");

    const closeButton = screen.getByTestId("close");
    expect(closeButton).toHaveAttribute("toast-close", "");

    rerender(
      <ToastProvider>
        <Toast
          open
          data-testid="toast"
          onOpenChange={() => {}}
          variant="destructive"
        >
          <ToastTitle>Warning</ToastTitle>
          <ToastDescription>Problem!</ToastDescription>
          <ToastAction altText="Dismiss">Dismiss</ToastAction>
          <ToastClose data-testid="close" />
        </Toast>
        <ToastViewport />
      </ToastProvider>
    );

    const destructiveToast = screen.getByTestId("toast");
    expect(destructiveToast.className).toContain("destructive");
  });

  it("exposes a progress indicator with configurable duration", () => {
    render(
      <ToastProvider>
        <Toast open data-testid="toast" onOpenChange={() => {}}>
          <ToastTitle>Loading</ToastTitle>
          <ToastProgress duration={2000} data-testid="progress" />
        </Toast>
        <ToastViewport />
      </ToastProvider>
    );

    const progress = screen.getByTestId("progress") as HTMLElement;
    expect(progress).toBeInTheDocument();
    expect(progress.style.getPropertyValue("--toast-progress-duration")).toBe(
      "2000ms"
    );
  });
});
