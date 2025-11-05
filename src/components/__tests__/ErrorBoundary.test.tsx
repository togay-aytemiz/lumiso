import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ErrorBoundary from "../ErrorBoundary";

jest.mock("react-i18next", () => ({
  withTranslation: () =>
    (Component: React.ComponentType<Record<string, unknown>>) =>
      function WithTranslationWrapper(props: Record<string, unknown>) {
        return (
          <Component
            {...props}
            t={(key: string, options?: Record<string, string>) =>
              options?.reference ? `${key}:${options.reference}` : key
            }
          />
        );
      },
}));

describe("ErrorBoundary", () => {
  let consoleErrorSpy: jest.SpyInstance;
  let originalClipboard: typeof navigator.clipboard;

  beforeEach(() => {
    consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    originalClipboard = navigator.clipboard;
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn().mockResolvedValue(undefined),
      },
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    Object.assign(navigator, { clipboard: originalClipboard });
  });

  it("renders children when no error occurs", () => {
    render(
      <ErrorBoundary>
        <div data-testid="safe-child">Content</div>
      </ErrorBoundary>
    );

    expect(screen.getByTestId("safe-child")).toBeInTheDocument();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("renders default fallback UI when an error is thrown", async () => {
    const onError = jest.fn();

    const ProblemChild = () => {
      throw new Error("Boom");
    };

    render(
      <ErrorBoundary onError={onError}>
        <ProblemChild />
      </ErrorBoundary>
    );

    expect(await screen.findByText("errorBoundary.title")).toBeInTheDocument();
    expect(screen.getByText("Boom")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "buttons.tryAgain" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "buttons.reload" })).toBeInTheDocument();
    expect(onError).toHaveBeenCalled();
  });

  it("supports providing a custom fallback component", () => {
    const ProblemChild = () => {
      throw new Error("Boom");
    };

    render(
      <ErrorBoundary fallback={<div data-testid="custom-fallback" />}> 
        <ProblemChild />
      </ErrorBoundary>
    );

    expect(screen.getByTestId("custom-fallback")).toBeInTheDocument();
    expect(screen.queryByText("errorBoundary.title")).not.toBeInTheDocument();
  });

  it("copies error details to clipboard when requested", async () => {
    const ProblemChild = () => {
      throw new Error("Boom");
    };

    render(
      <ErrorBoundary>
        <ProblemChild />
      </ErrorBoundary>
    );

    const copyButton = await screen.findByRole("button", { name: "buttons.copy" });
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining("Boom")
      );
    });
  });

  it("provides contextual summary for reference errors", async () => {
    const ProblemChild = () => {
      throw new ReferenceError("foo is not defined");
    };

    render(
      <ErrorBoundary>
        <ProblemChild />
      </ErrorBoundary>
    );

    expect(
      await screen.findByText("errorBoundary.missingReference:foo")
    ).toBeInTheDocument();
  });
});
