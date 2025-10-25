import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const sanitizeTestId = (title: string) =>
  title.toLowerCase().replace(/[^a-z0-9]+/g, "-");

const sidebarNavItemMock = jest.fn(
  ({ title, children, isActive, isLocked }: any) => (
    <div
      data-testid={`nav-${sanitizeTestId(String(title))}`}
      data-active={isActive ?? false}
      data-locked={isLocked ?? false}
    >
      {title}
      {children}
    </div>
  )
);

const sidebarSubItemMock = jest.fn(
  ({ title, isActive, isLocked }: any) => (
    <div
      data-testid={`sub-${sanitizeTestId(String(title))}`}
      data-active={isActive ?? false}
      data-locked={isLocked ?? false}
    >
      {title}
    </div>
  )
);

jest.mock("@/components/ui/sidebar", () => ({
  Sidebar: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock("@/components/sidebar/SidebarCategory", () => ({
  SidebarCategory: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock("@/components/sidebar/SidebarNavItem", () => ({
  SidebarNavItem: (props: any) => sidebarNavItemMock(props),
}));

jest.mock("@/components/sidebar/SidebarSubItem", () => ({
  SidebarSubItem: (props: any) => sidebarSubItemMock(props),
}));

jest.mock("@/components/modals/HelpModal", () => ({
  HelpModal: () => <div data-testid="help-modal" />, 
}));

jest.mock("@/components/UserMenu", () => ({
  UserMenu: () => <div data-testid="user-menu" />, 
}));

jest.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock("@/hooks/useTypedTranslation", () => ({
  useNavigationTranslation: jest.fn(),
}));

jest.mock("@/contexts/OnboardingContext", () => ({
  useOnboarding: jest.fn(),
}));

jest.mock("@/hooks/useUserRole", () => ({
  useUserRole: jest.fn(),
}));

jest.mock("@/hooks/use-mobile", () => ({
  useIsMobile: jest.fn(),
}));

jest.mock("@/assets/Logo.png", () => "logo-mock.png", { virtual: true });

import { AppSidebar } from "../AppSidebar";
import { useNavigationTranslation } from "@/hooks/useTypedTranslation";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useIsMobile } from "@/hooks/use-mobile";

describe("AppSidebar", () => {
  const renderSidebar = (initialPath: string = "/") =>
    render(
      <MemoryRouter initialEntries={[initialPath]}>
        <AppSidebar />
      </MemoryRouter>
    );

  beforeEach(() => {
    jest.clearAllMocks();

    (useNavigationTranslation as jest.Mock).mockReturnValue({
      t: (key: string) => key,
    });

    (useOnboarding as jest.Mock).mockReturnValue({
      shouldLockNavigation: false,
      loading: false,
    });

    (useIsMobile as jest.Mock).mockReturnValue(false);

    (useUserRole as jest.Mock).mockReturnValue({
      isAdminOrSupport: jest.fn(() => false),
    });
  });

  it("marks the current route as active", () => {
    renderSidebar("/projects");

    expect(screen.getByTestId("nav-menu-projects")).toHaveAttribute("data-active", "true");
    expect(screen.getByTestId("nav-menu-dashboard")).toHaveAttribute("data-active", "false");
  });

  it("renders administration link only for admin or support roles", () => {
    const initialRender = renderSidebar("/");
    expect(screen.queryByTestId("nav-menu-administration")).toBeNull();

    initialRender.unmount();

    (useUserRole as jest.Mock).mockReturnValue({
      isAdminOrSupport: jest.fn(() => true),
    });

    renderSidebar("/");
    expect(screen.getByTestId("nav-menu-administration")).toBeInTheDocument();
  });
});
