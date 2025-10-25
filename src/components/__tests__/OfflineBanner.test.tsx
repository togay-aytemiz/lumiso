import { fireEvent, render, screen } from "@testing-library/react";
import OfflineBanner from "../OfflineBanner";
import { useConnectivity } from "@/contexts/ConnectivityContext";

jest.mock("@/contexts/ConnectivityContext", () => ({
  useConnectivity: jest.fn(),
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const mockUseConnectivity = useConnectivity as jest.MockedFunction<
  typeof useConnectivity
>;

describe("OfflineBanner", () => {
  afterEach(() => {
    mockUseConnectivity.mockReset();
  });

  it("renders nothing when online", () => {
    mockUseConnectivity.mockReturnValue({
      isOffline: false,
      isRetrying: false,
      runRetryAll: jest.fn(),
    });

    const { container } = render(<OfflineBanner />);

    expect(container).toBeEmptyDOMElement();
  });

  it("shows offline messaging and triggers retry action", () => {
    const runRetryAll = jest.fn();
    mockUseConnectivity.mockReturnValue({
      isOffline: true,
      isRetrying: false,
      runRetryAll,
    });

    render(<OfflineBanner />);

    expect(screen.getByText("network.offlineTitle")).toBeInTheDocument();
    expect(screen.getByText("network.offlineDescription")).toBeInTheDocument();
    const retryButton = screen.getByRole("button", {
      name: "buttons.tryAgain",
    });
    fireEvent.click(retryButton);

    expect(runRetryAll).toHaveBeenCalledTimes(1);
  });

  it("disables retry button and shows spinner while retrying", () => {
    mockUseConnectivity.mockReturnValue({
      isOffline: true,
      isRetrying: true,
      runRetryAll: jest.fn(),
    });

    render(<OfflineBanner />);

    const retryButton = screen.getByRole("button", {
      name: "buttons.tryAgain",
    });
    expect(retryButton).toBeDisabled();
    expect(retryButton.querySelector(".animate-spin")).not.toBeNull();
  });
});
