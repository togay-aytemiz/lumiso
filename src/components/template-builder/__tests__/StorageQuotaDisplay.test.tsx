import React from "react";
import { render, screen, fireEvent, waitFor } from "@/utils/testUtils";
import { StorageQuotaDisplay } from "../StorageQuotaDisplay";

interface StorageUsage {
  total_images: number;
  total_storage_bytes: number;
}

interface TemplateAsset {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  created_at: string;
}

type ToastMock = (...args: unknown[]) => void;
const toastMock = jest.fn<void, Parameters<ToastMock>>();

type UsageSingleResponse = { data: StorageUsage; error: null };
type UsageSingleFn = jest.Mock<Promise<UsageSingleResponse>, []>;
type UsageEqFn = jest.Mock<{ single: UsageSingleFn }, [string, string]>;
type UsageSelectFn = jest.Mock<{ eq: UsageEqFn }, [string]>;
interface UsageQueryBuilder {
  select: UsageSelectFn;
}

type AssetsOrderResponse = { data: TemplateAsset[]; error: null };
type AssetsOrderFn = jest.Mock<Promise<AssetsOrderResponse>, [string, { ascending: boolean }]>;
type AssetsEqFn = jest.Mock<{ order: AssetsOrderFn }, [string, string]>;
type AssetsSelectFn = jest.Mock<{ eq: AssetsEqFn }, [string]>;
interface AssetsQueryBuilder {
  select: AssetsSelectFn;
}

type DeleteEqFn = jest.Mock<Promise<{ error: null }>, [string, string]>;
type DeleteFn = jest.Mock<{ eq: DeleteEqFn }, []>;

type StorageRemoveFn = jest.Mock<Promise<{ error: null }>, [string[]]>;

type SupabaseFromReturn =
  | UsageQueryBuilder
  | (AssetsQueryBuilder & { delete: DeleteFn })
  | Record<string, never>;

const fromMock = jest.fn<SupabaseFromReturn, [string]>();
const storageFromMock = jest.fn<{ remove: StorageRemoveFn }, [string]>();

const useOrganizationMock = jest.fn<
  { activeOrganization?: { id: string } } | undefined,
  []
>();
const useAuthMock = jest.fn<{ user?: { id: string } } | undefined, []>();

jest.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: (...args: Parameters<typeof toastMock>) => toastMock(...args),
  }),
}));

jest.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: Parameters<typeof fromMock>) => fromMock(...args),
    storage: {
      from: (...args: Parameters<typeof storageFromMock>) =>
        storageFromMock(...args),
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
  interface DialogContextValue {
    open: boolean;
    onOpenChange?: (open: boolean) => void;
  }

  const DialogContext = React.createContext<DialogContextValue>({
    open: false,
  });

  interface DialogProps extends React.PropsWithChildren {
    open: boolean;
    onOpenChange?: (open: boolean) => void;
  }

  const Dialog: React.FC<DialogProps> = ({ open, onOpenChange, children }) => (
    <DialogContext.Provider value={{ open, onOpenChange }}>
      {children}
    </DialogContext.Provider>
  );

  interface DialogTriggerProps {
    asChild?: boolean;
    children: React.ReactNode;
  }

  const DialogTrigger: React.FC<DialogTriggerProps> = ({ asChild, children }) => {
    const ctx = React.useContext(DialogContext);

    const handleClick = () => ctx.onOpenChange?.(true);

    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children, {
        onClick: handleClick,
      });
    }

    return (
      <button type="button" onClick={handleClick}>
        {children}
      </button>
    );
  };

  const DialogContent: React.FC<React.PropsWithChildren> = ({ children }) => {
    const ctx = React.useContext(DialogContext);
    if (!ctx.open) {
      return null;
    }
    return <div>{children}</div>;
  };

  const DialogHeader: React.FC<React.PropsWithChildren> = ({ children }) => (
    <div>{children}</div>
  );
  const DialogTitle: React.FC<React.PropsWithChildren> = ({ children }) => (
    <div>{children}</div>
  );
  const DialogDescription: React.FC<React.PropsWithChildren> = ({
    children,
  }) => <div>{children}</div>;

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
  const AlertDialog: React.FC<React.PropsWithChildren> = ({ children }) => (
    <div>{children}</div>
  );

  const AlertDialogTrigger: React.FC<React.PropsWithChildren> = ({
    children,
  }) => <>{children}</>;
  const AlertDialogContent: React.FC<React.PropsWithChildren> = ({
    children,
  }) => <div>{children}</div>;
  const AlertDialogHeader: React.FC<React.PropsWithChildren> = ({
    children,
  }) => <div>{children}</div>;
  const AlertDialogFooter: React.FC<React.PropsWithChildren> = ({
    children,
  }) => <div>{children}</div>;
  const AlertDialogTitle: React.FC<React.PropsWithChildren> = ({
    children,
  }) => <div>{children}</div>;
  const AlertDialogDescription: React.FC<React.PropsWithChildren> = ({
    children,
  }) => <div>{children}</div>;

  const makeButton =
    (): React.FC<React.PropsWithChildren<React.ButtonHTMLAttributes<HTMLButtonElement>>> =>
    ({ children, ...props }) =>
      (
        <button type="button" {...props}>
          {children}
        </button>
      );

  const AlertDialogCancel = makeButton();
  const AlertDialogAction = makeButton();

  return {
    AlertDialog,
    AlertDialogTrigger,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogFooter,
    AlertDialogTitle,
    AlertDialogDescription,
    AlertDialogCancel,
    AlertDialogAction,
  };
});

const createUsageBuilder = (usage: StorageUsage) => {
  const single: UsageSingleFn = jest
    .fn<Promise<UsageSingleResponse>, []>()
    .mockResolvedValue({ data: usage, error: null });
  const eq: UsageEqFn = jest.fn(() => ({ single }));
  const select: UsageSelectFn = jest.fn(() => ({ eq }));
  return { select, eq, single };
};

const createAssetsBuilder = (assets: TemplateAsset[]) => {
  const order: AssetsOrderFn = jest
    .fn<Promise<AssetsOrderResponse>, [string, { ascending: boolean }]>()
    .mockResolvedValue({ data: assets, error: null });
  const eq: AssetsEqFn = jest.fn(() => ({ order }));
  const select: AssetsSelectFn = jest.fn(() => ({ eq }));
  return { select, eq, order };
};

beforeEach(() => {
  toastMock.mockClear();
  fromMock.mockReset();
  storageFromMock.mockReset();
  useOrganizationMock.mockReturnValue({ activeOrganization: { id: "org-1" } });
  useAuthMock.mockReturnValue({ user: { id: "user-1" } });
});

const renderQuota = async (
  usage: StorageUsage,
  assets: TemplateAsset[] = []
) => {
  const usageBuilder = createUsageBuilder(usage);
  const assetsBuilder = createAssetsBuilder(assets);
  const deleteEqMock: DeleteEqFn = jest
    .fn<Promise<{ error: null }>, [string, string]>()
    .mockResolvedValue({ error: null });

  fromMock.mockImplementation((table) => {
    if (table === "template_image_usage") {
      return { select: usageBuilder.select };
    }

    if (table === "template_assets") {
      const deleteFn: DeleteFn = jest.fn(() => ({ eq: deleteEqMock }));
      return {
        select: assetsBuilder.select,
        delete: deleteFn,
      };
    }

    return {};
  });

  const removeMock: StorageRemoveFn = jest
    .fn<Promise<{ error: null }>, [string[]]>()
    .mockResolvedValue({ error: null });
  storageFromMock.mockReturnValue({
    remove: removeMock,
  });

  render(<StorageQuotaDisplay />);

  await waitFor(() => {
    expect(usageBuilder.select).toHaveBeenCalled();
  });

  return { usageBuilder, assetsBuilder };
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
