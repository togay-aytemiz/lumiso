import React from "react";
import { render, screen } from "@/utils/testUtils";
import AdminSystem from "../System";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
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

describe("Admin System page", () => {
  it("renders system metrics sections with translation keys", () => {
    render(<AdminSystem />);

    expect(screen.getByText("admin.system.title")).toBeInTheDocument();
    expect(screen.getByText("admin.system.subtitle")).toBeInTheDocument();
    expect(screen.getByTestId("badge")).toHaveTextContent("admin.system.badge");
    expect(screen.getByText("admin.system.features.performance.title")).toBeInTheDocument();
  });
});
