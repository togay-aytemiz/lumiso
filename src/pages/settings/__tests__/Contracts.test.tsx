import type { ReactNode } from "react";
import { render, screen } from "@/utils/testUtils";
import Contracts from "../Contracts";
const mockHeader = jest.fn();

jest.mock("@/components/settings/SettingsPageWrapper", () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => (
    <div data-testid="settings-page-wrapper">{children}</div>
  ),
}));

jest.mock("@/components/settings/SettingsHeader", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockHeader(props);
    return null;
  },
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("Contracts settings page", () => {
  beforeEach(() => {
    mockHeader.mockClear();
  });

  it("renders the contracts content", () => {
    render(<Contracts />);

    expect(screen.getByTestId("settings-page-wrapper")).toBeInTheDocument();
    expect(screen.getByText("settings.contracts.comingSoon")).toBeInTheDocument();
  });

  it("does not render the legacy header", () => {
    render(<Contracts />);
    expect(mockHeader).not.toHaveBeenCalled();
  });
});
