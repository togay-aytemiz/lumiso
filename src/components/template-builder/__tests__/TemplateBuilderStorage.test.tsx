import { render, screen, waitFor, fireEvent } from "@/utils/testUtils";
import { CompactStorageIndicator } from "../CompactStorageIndicator";
import { supabase } from "@/integrations/supabase/client";

jest.mock("@/contexts/OrganizationContext", () => ({
  useOrganization: jest.fn(() => ({ activeOrganization: { id: "org-1" } })),
}));

jest.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: jest.fn(),
  },
}));

const translationMap: Record<string, string> = {
  "templateBuilder.imageManager.storage.usage": "{{count}}/{{max}} images",
  "templateBuilder.imageManager.storage.size": "{{used}}/{{limit}}",
  "templateBuilder.imageManager.storage.manage": "Manage Images",
  "templateBuilder.imageManager.storage.limitReached": "Limit Reached",
  "templateBuilder.imageManager.storage.nearLimit": "Near Limit",
};

const interpolateTranslation = (
  template: string,
  options?: Record<string, unknown>
) => {
  if (!options) {
    return template;
  }

  return template.replace(/{{(\w+)}}/g, (_match, key) =>
    Object.prototype.hasOwnProperty.call(options, key)
      ? String(options[key])
      : ""
  );
};

jest.mock("react-i18next", () => ({
  useTranslation: jest.fn(() => ({
    t: (key: string, options?: Record<string, unknown>) => {
      const template = translationMap[key];
      if (!template) {
        return key;
      }
      return interpolateTranslation(template, options);
    },
  })),
}));

interface StorageUsageData {
  total_images: number;
  total_storage_bytes: number;
}

function mockStorageUsageResponse(data: StorageUsageData | null, error: unknown = null) {
  (supabase.from as jest.Mock).mockImplementation(() => ({
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({ data, error }),
      }),
    }),
  }));
}

describe("CompactStorageIndicator", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("displays usage details and near-limit badge when approaching limits", async () => {
    mockStorageUsageResponse({
      total_images: 45,
      total_storage_bytes: 40 * 1024 * 1024,
    });

    const onManageImages = jest.fn();

    render(<CompactStorageIndicator onManageImages={onManageImages} />);

    await waitFor(() =>
      expect(screen.getByText("45/50 images")).toBeInTheDocument()
    );

    expect(screen.getByText("Near Limit")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Manage/i }));
    expect(onManageImages).toHaveBeenCalled();
  });

  it("shows limit reached badge when thresholds are exceeded", async () => {
    mockStorageUsageResponse({
      total_images: 50,
      total_storage_bytes: 52 * 1024 * 1024,
    });

    render(<CompactStorageIndicator />);

    await waitFor(() =>
      expect(screen.getByText("50/50 images")).toBeInTheDocument()
    );

    expect(screen.getByText("Limit Reached")).toBeInTheDocument();
  });
});
