import type { ReactNode } from "react";
import { act } from "@testing-library/react";
import { fireEvent, render, screen, waitFor } from "@/utils/testUtils";
import { MobileBottomNav } from "../MobileBottomNav";
import { useProfile } from "@/hooks/useProfile";

const navigateMock = jest.fn();
const useNavigateMock = jest.fn(() => navigateMock);
const useLocationMock = jest.fn(() => ({ pathname: "/" }));
const useProfileMock = useProfile as jest.MockedFunction<typeof useProfile>;

jest.mock("react-router-dom", () => {
  const actual = jest.requireActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => useNavigateMock(),
    useLocation: () => useLocationMock(),
  };
});

type MockSheetItem = {
  title: string;
  onClick: () => Promise<void> | void;
};

type MockBottomSheetMenuProps = {
  title: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  items: MockSheetItem[];
  leadingContent?: ReactNode;
  customContent?: ReactNode;
};

const sheetPropsByTitle: Record<string, MockBottomSheetMenuProps> = {};

type HelpModalProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
};

type UserMenuProps = {
  variant?: "sidebar" | "mobile" | "minimal";
  onNavigate?: () => void;
};

jest.mock("../BottomSheetMenu", () => ({
  BottomSheetMenu: (props: MockBottomSheetMenuProps) => {
    sheetPropsByTitle[props.title] = props;
    return (
      <div data-testid={`sheet-${props.title}`} data-open={props.isOpen ? "true" : "false"}>
        {props.leadingContent}
        {props.customContent}
      </div>
    );
  },
}));

const helpModalMock = jest.fn();

jest.mock("@/components/modals/HelpModal", () => ({
  HelpModal: (props: HelpModalProps) => {
    helpModalMock(props);
    return <div data-testid="help-modal" data-open={props.isOpen ? "true" : "false"} />;
  },
}));

const userMenuMock = jest.fn();

jest.mock("@/components/UserMenu", () => ({
  UserMenu: (props: UserMenuProps) => {
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

jest.mock("@/hooks/useProfile", () => ({
  useProfile: jest.fn(),
}));

jest.mock("lucide-react", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  return new Proxy(
    {},
    {
      get: (_target, property: PropertyKey) => (props: { className?: string }) =>
        React.createElement("svg", {
          ...props,
          "data-icon": String(property),
        }),
    }
  );
});

const scrollToMock = jest.fn();
const confirmMock = jest.fn(() => true);

Object.defineProperty(window, "scrollTo", {
  configurable: true,
  writable: true,
  value: scrollToMock,
});

Object.defineProperty(window, "confirm", {
  configurable: true,
  writable: true,
  value: confirmMock,
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
    useProfileMock.mockReturnValue({ profile: { firstName: "Taylor" } });
    scrollToMock.mockReset();
    confirmMock.mockReset();
    confirmMock.mockReturnValue(true);
    toastMock.mockReset();
  });

  it("navigates to a new route when a tab with a path is pressed", async () => {
    useLocationMock.mockReturnValue({ pathname: "/leads" });

    await renderNav();
    fireEvent.click(screen.getByRole("button", { name: "Projects" }));

    expect(navigateMock).toHaveBeenCalledWith("/projects");
    expect(scrollToMock).not.toHaveBeenCalled();
  });

  it("scrolls to top instead of navigating when the active tab is pressed", async () => {
    useLocationMock.mockReturnValue({ pathname: "/projects" });

    await renderNav();
    fireEvent.click(screen.getByRole("button", { name: "Projects" }));

    expect(navigateMock).not.toHaveBeenCalledWith("/projects");
    expect(scrollToMock).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
  });

  it("opens and closes the More sheet via tab actions and UserMenu callbacks", async () => {
    useLocationMock.mockReturnValue({ pathname: "/dashboard" });

    await renderNav();

    fireEvent.click(screen.getByRole("button", { name: "More" }));
    await waitFor(() => {
      expect(sheetPropsByTitle["More"]?.isOpen).toBe(true);
    });
    expect(userMenuMock).toHaveBeenCalled();

    const latestMenuProps = userMenuMock.mock.calls.at(-1)?.[0] as UserMenuProps | undefined;
    expect(latestMenuProps).toBeDefined();
    await act(async () => {
      latestMenuProps?.onNavigate?.();
    });

    await waitFor(() => {
      expect(sheetPropsByTitle["More"]?.isOpen).toBe(false);
    });
  });

  it("invokes Supabase sign out and navigates to auth when confirmed", async () => {
    await renderNav();

    const moreSheet = sheetPropsByTitle["More"];
    expect(moreSheet).toBeDefined();
    const signOutItem = moreSheet?.items.find((item) => item.title === "Sign Out");
    expect(signOutItem).toBeDefined();

    await act(async () => {
      await signOutItem?.onClick();
    });

    expect(confirmMock).toHaveBeenCalledWith("Are you sure you want to sign out?");
    expect(signOutMock).toHaveBeenCalledWith();
    expect(navigateMock).toHaveBeenCalledWith("/auth");
    expect(toastMock).not.toHaveBeenCalled();
  });

  it("surfaces toast errors when sign out fails", async () => {
    const error = new Error("sign-out-failed");
    signOutMock.mockRejectedValue(error);

    await renderNav();
    const moreSheet = sheetPropsByTitle["More"];
    expect(moreSheet).toBeDefined();
    const signOutItem = moreSheet?.items.find((item) => item.title === "Sign Out");
    expect(signOutItem).toBeDefined();

    await act(async () => {
      await signOutItem?.onClick();
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
