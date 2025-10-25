import { render, screen } from "@/utils/testUtils";
import NotFound from "../NotFound";
import { useLocation } from "react-router-dom";

jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useLocation: jest.fn(),
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const mockUseLocation = useLocation as jest.Mock;

describe("NotFound page", () => {
  const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseLocation.mockReturnValue({ pathname: "/missing" });
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
  });

  it("logs the missing route and renders support link", () => {
    render(<NotFound />);

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "404 Error: User attempted to access non-existent route:",
      "/missing"
    );

    expect(screen.getByText("errors.notFound.title")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "errors.notFound.cta" });
    expect(link).toHaveAttribute("href", "/");
  });
});
