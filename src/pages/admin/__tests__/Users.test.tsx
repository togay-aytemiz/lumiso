import React from "react";
import { render, screen } from "@/utils/testUtils";
import AdminUsers from "../Users";

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
    session: { access_token: "token" },
    userRoles: ["admin"],
    loading: false,
  }),
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en" },
  }),
}));

jest.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <header>{children}</header>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  CardDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span data-testid="badge">{children}</span>,
}));

describe("Admin Users page", () => {
  it("renders the expected sections and translation keys", () => {
    render(<AdminUsers />);

    expect(screen.getByText("admin.users.title")).toBeInTheDocument();
    expect(screen.getByText("admin.users.subtitle")).toBeInTheDocument();
    expect(screen.getByText("admin.users.tableTitle")).toBeInTheDocument();
    expect(screen.getByText("admin.users.actions.refresh")).toBeInTheDocument();
  });
});
