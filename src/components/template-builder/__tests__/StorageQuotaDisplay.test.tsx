import React from "react";
import { render, screen, fireEvent, waitFor } from "@/utils/testUtils";
import { StorageQuotaDisplay } from "../StorageQuotaDisplay";

const toastMock = jest.fn();
const fromMock = jest.fn();
const storageFromMock = jest.fn();
const useOrganizationMock = jest.fn();
const useAuthMock = jest.fn();

jest.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: (...args: unknown[]) => toastMock(...args),
  }),
}));

jest.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
    storage: {
      from: (...args: unknown[]) => storageFromMock(...args),
    },
  },
}));

jest.mock("@/contexts/OrganizationContext", () => ({
  useOrganization: () => useOrganizationMock(),
}));

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => useAuthMock(),
}));

jest.mock("@/components/ui/dialog", () => {
  const React = require("react");
  const DialogContext = React.createContext<{ open: boolean; onOpenChange?: (open: boolean) => void }>({ open: false });

  const Dialog = ({ open, onOpenChange, children }: any) => (
    <DialogContext.Provider value={{ open, onOpenChange }}>{children}</DialogContext.Provider>
  );

  const DialogTrigger = ({ asChild, children }: any) => {
    const ctx = React.useContext(DialogContext);
    const triggerProps = {
      onClick: (event: React.MouseEvent) => {
        ctx.onOpenChange?.(true);
        if (typeof children?.props?.onClick === "function") {
          children.props.onClick(event);
        }
      },
    };
    return asChild ? React.cloneElement(children, triggerProps) : <button type="button" {...triggerProps}>{children}</button>;
  };

  const DialogContent = ({ children }: any) => {
    const ctx = React.useContext(DialogContext);
    if (!ctx.open) return null;
    return <div>{children}</div>;
  };

  const DialogHeader = ({ children }: any) => <div>{children}</div>;
  const DialogTitle = ({ children }: any) => <div>{children}</div>;
  const DialogDescription = ({ children }: any) => <div>{children}</div>;

  return {
    Dialog,
    DialogTrigger,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
  };
});

jest.mock("@/components/ui/alert-dialog", () => {
  const React = require("react");
  return {
    AlertDialog: ({ children }: any) => <div>{children}</div>,
    AlertDialogTrigger: ({ children }: any) => <>{children}</>,
    AlertDialogContent: ({ children }: any) => <div>{children}</div>,
    AlertDialogHeader: ({ children }: any) => <div>{children}</div>,
    AlertDialogFooter: ({ children }: any) => <div>{children}</div>,
    AlertDialogTitle: ({ children }: any) => <div>{children}</div>,
    AlertDialogDescription: ({ children }: any) => <div>{children}</div>,
    AlertDialogCancel: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
      <button type="button" {...props}>{children}</button>
    ),
    AlertDialogAction: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
      <button type="button" {...props}>{children}</button>
    ),
  };
});

const createUsageChain = (usage: { total_images: number; total_storage_bytes: number }) => {
  const single = jest.fn().mockResolvedValue({ data: usage, error: null });
  const eq = jest.fn(() => ({ single }));
  return { select: jest.fn(() => ({ eq })) };
};

const createAssetsChain = (assets: any[]) => {
  const order = jest.fn().mockResolvedValue({ data: assets, error: null });
  const eq = jest.fn(() => ({ order }));
  return { select: jest.fn(() => ({ eq })) };
};

beforeEach(() => {
  toastMock.mockClear();
  fromMock.mockReset();
  storageFromMock.mockReset();
  useOrganizationMock.mockReturnValue({ activeOrganization: { id: "org-1" } });
  useAuthMock.mockReturnValue({ user: { id: "user-1" } });
});

const renderQuota = async (usage: { total_images: number; total_storage_bytes: number }, assets: any[] = []) => {
  const usageChain = createUsageChain(usage);
  const assetsChain = createAssetsChain(assets);
  const deleteEqMock = jest.fn().mockResolvedValue({ error: null });

  fromMock.mockImplementation((table: string) => {
    switch (table) {
      case "template_image_usage":
        return usageChain;
      case "template_assets":
        return {
          ...assetsChain,
          delete: jest.fn(() => ({ eq: deleteEqMock })),
        };
      default:
        return {};
    }
  });

  const removeMock = jest.fn().mockResolvedValue({ error: null });
  storageFromMock.mockReturnValue({
    remove: removeMock,
  });

  render(<StorageQuotaDisplay />);

  await waitFor(() => {
    expect(usageChain.select).toHaveBeenCalled();
  });

  return { usageChain, assetsChain };
};

describe("StorageQuotaDisplay", () => {
  it("renders usage information and opens manage dialog", async () => {
    await renderQuota(
      { total_images: 18, total_storage_bytes: 42 * 1024 * 1024 },
      [
        {
          id: "asset-1",
          file_name: "studio.jpg",
          file_path: "studio.jpg",
          file_size: 1024 * 1024,
          created_at: "2024-01-01T00:00:00Z",
        },
      ]
    );

    expect(screen.getByText("Images (18/20)")).toBeInTheDocument();
    expect(screen.getAllByText("Near Limit")).not.toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: /Manage Images/ }));
    await waitFor(() => {
      expect(screen.getByText("studio.jpg")).toBeInTheDocument();
    });
  });

  it("shows limit reached badge and warning banner", async () => {
    await renderQuota(
      { total_images: 22, total_storage_bytes: 50 * 1024 * 1024 },
      []
    );

    expect(screen.getAllByText("Limit Reached")).not.toHaveLength(0);
    expect(
      screen.getByText(/Upload limit reached\. Delete some images to free up space\./)
    ).toBeInTheDocument();
  });

});
