import React from "react";
import { fireEvent, render, screen, waitFor } from "@/utils/testUtils";
import { CompactStorageIndicator } from "../CompactStorageIndicator";

const fromMock = jest.fn();
const toastMock = jest.fn();
const useOrganizationMock = jest.fn();

jest.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
  },
}));

jest.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: (...args: unknown[]) => toastMock(...args),
  }),
}));

jest.mock("@/contexts/OrganizationContext", () => ({
  useOrganization: () => useOrganizationMock(),
}));

const createUsageChain = (usage: { total_images: number; total_storage_bytes: number }) => {
  const single = jest.fn().mockResolvedValue({ data: usage, error: null });
  const eq = jest.fn(() => ({ single }));
  return { select: jest.fn(() => ({ eq })) };
};

beforeEach(() => {
  fromMock.mockReset();
  toastMock.mockReset();
  useOrganizationMock.mockReturnValue({ activeOrganization: { id: "org-1" } });
});

const renderIndicator = async (usage: { total_images: number; total_storage_bytes: number }, props: Partial<React.ComponentProps<typeof CompactStorageIndicator>> = {}) => {
  const usageChain = createUsageChain(usage);
  fromMock.mockImplementation((table: string) => {
    if (table === "template_image_usage") {
      return usageChain;
    }
    return {};
  });

  render(<CompactStorageIndicator {...props} />);

  await waitFor(() => {
    expect(usageChain.select).toHaveBeenCalled();
  });

  return { usageChain };
};

describe("CompactStorageIndicator", () => {
  it("invokes onManageImages when manage button clicked", async () => {
    const handleManage = jest.fn();

    await renderIndicator(
      { total_images: 10, total_storage_bytes: 10 * 1024 * 1024 },
      { onManageImages: handleManage }
    );

    fireEvent.click(screen.getByRole("button", { name: /Manage/ }));
    expect(handleManage).toHaveBeenCalled();
  });

  it("shows near limit badge", async () => {
    await renderIndicator({ total_images: 45, total_storage_bytes: 40 * 1024 * 1024 });

    expect(screen.getByText(/Near Limit/)).toBeInTheDocument();
  });

  it("shows limit reached badge when thresholds exceeded", async () => {
    await renderIndicator({ total_images: 55, total_storage_bytes: 51 * 1024 * 1024 });

    expect(screen.getByText(/Limit Reached/)).toBeInTheDocument();
  });
});
