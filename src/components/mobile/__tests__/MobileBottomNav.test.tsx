import { act } from "@testing-library/react";
import { fireEvent, render, screen, waitFor } from "@/utils/testUtils";
import { MobileBottomNav } from "../MobileBottomNav";
import { useProfile } from "@/contexts/ProfileContext";

const navigateMock = jest.fn();
const useNavigateMock = jest.fn(() => navigateMock);
const useLocationMock = jest.fn(() => ({ pathname: "/" }));

jest.mock("react-router-dom", () => {
  const actual = jest.requireActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => useNavigateMock(),
    useLocation: () => useLocationMock(),
  };
});

const sheetPropsByTitle: Record<string, any> = {};

jest.mock("../BottomSheetMenu", () => ({
  BottomSheetMenu: (props: any) => {
    sheetPropsByTitle[props.title] = props;
    return (
      <div data-testid={`sheet-${props.title}`} data-open={props.isOpen ? "true" : "false"}>
        {props.customContent}
      </div>
    );
  },
}));

const helpModalMock = jest.fn();

jest.mock("@/components/modals/HelpModal", () => ({
  HelpModal: (props: any) => {
    helpModalMock(props);
    return <div data-testid="help-modal" data-open={props.isOpen ? "true" : "false"} />;
  },
}));

const userMenuMock = jest.fn();

jest.mock("@/components/UserMenu", () => ({
  UserMenu: (props: any) => {
    userMenuMock(props);
    return <div data-testid="user-menu" />;
  },
}));

const toastMock = jest.fn();

jest.mock("@/hooks/use-toast", () => ({
  toast: (...args: unknown[]) => toastMock(...args),
}));

const getUserMock = jest.fn();
const signOutMock = jest.fn();

jest.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: (...args: unknown[]) => getUserMock(...args),
      signOut: (...args: unknown[]) => signOutMock(...args),
    },
  },
}));

jest.mock("@/contexts/ProfileContext", () => ({
  useProfile: jest.fn(),
}));

jest.mock("lucide-react", () => {
  const React = jest.requireActual("react");
  return new Proxy(
    {},
    {
      get: (_target, property: PropertyKey) => (props: any) =>
        React.createElement("svg", {
          ...props,
          "data-icon": String(property),
        }),
    }
  );
});

describe("MobileBottomNav", () => {
  const renderNav = async () => {
    const result = render(<MobileBottomNav />);
    await waitFor(() => expect(getUserMock).toHaveBeenCalled());
    return result;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(sheetPropsByTitle).forEach((key) => delete sheetPropsByTitle[key]);
    useNavigateMock.mockReturnValue(navigateMock);
    useLocationMock.mockReturnValue({ pathname: "/" });
    getUserMock.mockResolvedValue({ data: { user: { email: "test@example.com" } }, error: null });
    signOutMock.mockResolvedValue(undefined);
    (useProfile as jest.Mock).mockReturnValue({ profile: { firstName: "Taylor" } });
    (window as any).scrollTo = jest.fn();
    (window as any).confirm = jest.fn(() => true);
    toastMock.mockReset();
  });

  it("navigates to a new route when a tab with a path is pressed", async () => {
    useLocationMock.mockReturnValue({ pathname: "/leads" });

    await renderNav();
    fireEvent.click(screen.getByRole("button", { name: "Projects" }));

    expect(navigateMock).toHaveBeenCalledWith("/projects");
    expect((window as any).scrollTo).not.toHaveBeenCalled();
  });

  it("scrolls to top instead of navigating when the active tab is pressed", async () => {
    useLocationMock.mockReturnValue({ pathname: "/projects" });

    await renderNav();
    fireEvent.click(screen.getByRole("button", { name: "Projects" }));

    expect(navigateMock).not.toHaveBeenCalledWith("/projects");
    expect((window as any).scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
  });

  it("opens and closes the More sheet via tab actions and UserMenu callbacks", async () => {
    useLocationMock.mockReturnValue({ pathname: "/dashboard" });

    await renderNav();

    fireEvent.click(screen.getByRole("button", { name: "More" }));
    await waitFor(() => expect(sheetPropsByTitle["More"].isOpen).toBe(true));
    expect(userMenuMock).toHaveBeenCalled();

    const latestMenuProps = userMenuMock.mock.calls[userMenuMock.mock.calls.length - 1][0];
    await act(async () => {
      latestMenuProps.onNavigate();
    });

    await waitFor(() => expect(sheetPropsByTitle["More"].isOpen).toBe(false));
  });

  it("invokes Supabase sign out and navigates to auth when confirmed", async () => {
    await renderNav();

    const moreItems = sheetPropsByTitle["More"].items;
    const signOutItem = moreItems.find((item: any) => item.title === "Sign Out");

    await act(async () => {
      await signOutItem.onClick();
    });

    expect(window.confirm).toHaveBeenCalledWith("Are you sure you want to sign out?");
    expect(signOutMock).toHaveBeenCalledWith();
    expect(navigateMock).toHaveBeenCalledWith("/auth");
    expect(toastMock).not.toHaveBeenCalled();
  });

  it("surfaces toast errors when sign out fails", async () => {
    const error = new Error("sign-out-failed");
    signOutMock.mockRejectedValue(error);

    await renderNav();
    const signOutItem = sheetPropsByTitle["More"].items.find((item: any) => item.title === "Sign Out");

    await act(async () => {
      await signOutItem.onClick();
    });

    expect(toastMock).toHaveBeenCalledWith({
      title: "Error signing out",
      description: error.message,
      variant: "destructive",
    });
    expect(navigateMock).not.toHaveBeenCalledWith("/auth");
  });

  it("hides the navigation on auth routes", async () => {
    useLocationMock.mockReturnValue({ pathname: "/auth" });

    await renderNav();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });
});
