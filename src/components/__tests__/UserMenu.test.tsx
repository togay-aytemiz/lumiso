import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@/utils/testUtils";
import { UserMenu } from "../UserMenu";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useFormsTranslation } from "@/hooks/useTypedTranslation";
import { useNavigate } from "react-router-dom";

jest.mock("@/hooks/useTypedTranslation", () => ({
  useFormsTranslation: jest.fn(),
}));

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: jest.fn(),
}));

jest.mock("@/hooks/useProfile", () => ({
  useProfile: jest.fn(),
}));

jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: jest.fn(),
}));

describe("UserMenu", () => {
  const mockSignOut = jest.fn();
  const mockNavigate = jest.fn();
  const mockOnNavigate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useFormsTranslation as jest.Mock).mockReturnValue({
      t: (key: string) => key,
      i18n: { language: "en" },
    });
    (useAuth as jest.Mock).mockReturnValue({
      user: { email: "jane@example.com" },
      signOut: mockSignOut.mockResolvedValue(undefined),
    });
    (useProfile as jest.Mock).mockReturnValue({
      profile: {
        full_name: "Jane Smith",
        profile_photo_url: undefined,
      },
    });
    (useNavigate as jest.Mock).mockReturnValue(mockNavigate);
  });

  it("renders minimal avatar variant with initials", () => {
    render(<UserMenu variant="minimal" />);

    expect(screen.getByText("JS")).toBeInTheDocument();
  });

  it("opens sidebar menu and handles navigation actions", async () => {
    render(<UserMenu variant="sidebar" onNavigate={mockOnNavigate} />);

    const user = userEvent.setup();

    await user.click(screen.getAllByText("Jane Smith")[0]);

    await user.click(
      await screen.findByRole("button", { name: "userMenu.profileSettings" })
    );
    expect(mockNavigate).toHaveBeenCalledWith(
      "/settings/profile",
      expect.objectContaining({
        state: expect.objectContaining({
          backgroundLocation: expect.objectContaining({ pathname: "/" }),
        }),
      })
    );
    expect(mockOnNavigate).toHaveBeenCalledTimes(1);

    await user.click(screen.getAllByText("Jane Smith")[0]);

    await user.click(
      await screen.findByRole("button", { name: "userMenu.signOut" })
    );
    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith("/auth");
    });
    expect(mockOnNavigate).toHaveBeenCalledTimes(2);
  });
});
