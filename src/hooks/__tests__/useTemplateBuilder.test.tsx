import { renderHook, act, waitFor } from "@testing-library/react";

import { useTemplateBuilder } from "../useTemplateBuilder";
import type { TemplateBuilderData } from "@/types/template";

type SupabaseChain = {
  select?: jest.Mock;
  update?: jest.Mock;
  insert?: jest.Mock;
  delete?: jest.Mock;
};

const toastMock = jest.fn();

jest.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: (...args: unknown[]) => toastMock(...args),
  }),
}));

const useOrganizationMock = jest.fn();
jest.mock("@/contexts/OrganizationContext", () => ({
  useOrganization: () => useOrganizationMock(),
}));

const useAuthMock = jest.fn();
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => useAuthMock(),
}));

const blocksToHTMLMock = jest.fn();
const blocksToMasterContentMock = jest.fn();
const htmlToBlocksMock = jest.fn();

jest.mock("@/lib/templateBlockUtils", () => ({
  blocksToHTML: (...args: unknown[]) => blocksToHTMLMock(...args),
  blocksToPlainText: jest.fn(),
  blocksToMasterContent: (...args: unknown[]) => blocksToMasterContentMock(...args),
  htmlToBlocks: (...args: unknown[]) => htmlToBlocksMock(...args),
}));

jest.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: jest.fn(),
  },
}));

const { supabase } = jest.requireMock("@/integrations/supabase/client") as {
  supabase: { from: jest.Mock };
};

describe("useTemplateBuilder", () => {
  let messageTemplatesTable: SupabaseChain;
  let templateChannelViewsTable: SupabaseChain;

  beforeEach(() => {
    useOrganizationMock.mockReturnValue({ activeOrganizationId: "org-123" });
    useAuthMock.mockReturnValue({ user: { id: "user-456" } });
    toastMock.mockReset();

    blocksToHTMLMock.mockReset();
    blocksToMasterContentMock.mockReset();
    htmlToBlocksMock.mockReset();

    messageTemplatesTable = {
      select: jest.fn(),
      update: jest.fn(),
      insert: jest.fn(),
      delete: jest.fn(),
    };

    templateChannelViewsTable = {
      delete: jest.fn(),
      insert: jest.fn(),
    };

    const defaultTemplate = {
      id: "",
      name: "",
      category: "",
      master_content: "",
      master_subject: "",
      placeholders: [],
      is_active: false,
      created_at: "",
      updated_at: "",
      user_id: "",
      organization_id: "",
      template_channel_views: [],
    };
    const defaultSingleMock = jest.fn().mockResolvedValue({ data: defaultTemplate, error: null });
    const defaultSecondEqMock = jest.fn(() => ({ single: defaultSingleMock }));
    const defaultFirstEqMock = jest.fn(() => ({ eq: defaultSecondEqMock }));
    messageTemplatesTable.select!.mockImplementation(() => ({ eq: defaultFirstEqMock }));

    templateChannelViewsTable.delete!.mockReturnValue({
      eq: jest.fn().mockResolvedValue({ error: null }),
    });
    templateChannelViewsTable.insert!.mockResolvedValue({ error: null });

    supabase.from.mockImplementation((table: string) => {
      if (table === "message_templates") {
        return messageTemplatesTable;
      }
      if (table === "template_channel_views") {
        return templateChannelViewsTable;
      }
      return {};
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("loads and transforms a template including HTML to blocks fallback", async () => {
    const mockBlocks = [
      {
        id: "text-1",
        type: "text",
        data: { content: "Hello" },
        visible: true,
        order: 0,
      },
    ];

    htmlToBlocksMock.mockReturnValue(mockBlocks);

    const singleMock = jest.fn().mockResolvedValue({
      data: {
        id: "tpl-1",
        name: "Welcome",
        category: "general",
        master_content: "Hello",
        master_subject: "Hi",
        placeholders: ["name"],
        is_active: false,
        created_at: "2024-01-01T00:00:00.000Z",
        updated_at: "2024-01-02T00:00:00.000Z",
        user_id: "user-456",
        organization_id: "org-123",
        template_channel_views: [
          {
            channel: "email",
            subject: "Greetings",
            content: "Hello there",
            html_content: "<p>hello</p>",
            metadata: { preheader: "Short line" },
          },
        ],
      },
      error: null,
    });

    const eqSecondMock = jest.fn(() => ({ single: singleMock }));
    const eqFirstMock = jest.fn(() => ({ eq: eqSecondMock }));
    messageTemplatesTable.select!.mockImplementation(() => ({ eq: eqFirstMock }));

    const { result } = renderHook(() => useTemplateBuilder("tpl-1"));

    await waitFor(() => expect(singleMock).toHaveBeenCalled());

    expect(result.current.template).not.toBeNull();
    expect(result.current.template?.blocks).toEqual(mockBlocks);
    expect(result.current.isDirty).toBe(false);
    expect(result.current.template?.preheader).toBe("Short line");
    expect(htmlToBlocksMock).toHaveBeenCalledWith("<p>hello</p>");
  });

  it("saves template with generated content and placeholders", async () => {
    const templateBlocks = [
      {
        id: "text-1",
        type: "text",
        data: { content: "Hello {name}" },
        visible: true,
        order: 0,
      },
    ];

    const builderTemplate = {
      id: "tpl-2",
      name: "Template",
      category: "general",
      master_content: "",
      master_subject: "",
      placeholders: [],
      is_active: false,
      created_at: "2024-01-01T00:00:00.000Z",
      updated_at: "2024-01-01T00:00:00.000Z",
      user_id: "user-456",
      organization_id: "org-123",
      description: "",
      subject: "Subject",
      preheader: "",
      blocks: templateBlocks,
      status: "draft",
      published_at: null,
      last_saved_at: null,
      channels: {
        email: { subject: "Subject", content: "Body", html_content: "<p>Existing</p>" },
        sms: { content: "Hi {name}" },
      },
    } as TemplateBuilderData;

    const insertSingleMock = jest.fn().mockResolvedValue({
      data: {
        ...builderTemplate,
        id: "tpl-2",
        master_content: "Generated {name}",
        placeholders: ["name"],
        updated_at: "2024-01-03T00:00:00.000Z",
      },
      error: null,
    });
    const insertSelectMock = jest.fn(() => ({ single: insertSingleMock }));
    messageTemplatesTable.insert!.mockImplementation(() => ({ select: insertSelectMock }));

    const insertChannelMock = jest.fn().mockResolvedValue({ error: null });
    templateChannelViewsTable.insert!.mockImplementation(insertChannelMock);

    blocksToMasterContentMock.mockReturnValue("Generated {name}");
    blocksToHTMLMock.mockReturnValue("<p>Generated {name}</p>");

    const { result } = renderHook(() => useTemplateBuilder());

    await act(async () => {
      result.current.updateTemplate(builderTemplate);
    });

    await act(async () => {
      await result.current.saveTemplate({});
    });

    expect(blocksToMasterContentMock).toHaveBeenCalledWith(templateBlocks);
    expect(blocksToHTMLMock).toHaveBeenCalledWith(templateBlocks);
    expect(messageTemplatesTable.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        placeholders: ["name"],
        blocks: templateBlocks,
        master_content: "Generated {name}",
      })
    );
    expect(insertChannelMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          channel: "email",
          html_content: "<p>Generated {name}</p>",
          metadata: null,
        }),
        expect.objectContaining({
          channel: "sms",
          content: "Hi {name}",
        }),
      ])
    );
    expect(result.current.isDirty).toBe(false);
    expect(result.current.lastSaved).toBeInstanceOf(Date);
    expect(toastMock).toHaveBeenCalledWith({
      title: "Saved",
      description: "Template saved successfully",
    });
  });

  it("publishes template and shows toast", async () => {
    const publishTemplateData = {
      id: "tpl-3",
      name: "Template",
      category: "general",
      master_content: "Content",
      master_subject: "Subject",
      placeholders: [],
      is_active: false,
      created_at: "2024-01-01T00:00:00.000Z",
      updated_at: "2024-01-02T00:00:00.000Z",
      user_id: "user-456",
      organization_id: "org-123",
      description: "",
      subject: "Subject",
      preheader: "",
      blocks: [],
      status: "draft",
      published_at: null,
      last_saved_at: null,
      channels: {},
    } as TemplateBuilderData;

    const publishInsertSingleMock = jest.fn().mockResolvedValue({
      data: {
        ...publishTemplateData,
        is_active: true,
        status: "published",
        updated_at: "2024-01-05T00:00:00.000Z",
      },
      error: null,
    });
    const publishInsertSelectMock = jest.fn(() => ({ single: publishInsertSingleMock }));
    messageTemplatesTable.insert!.mockImplementation(() => ({ select: publishInsertSelectMock }));

    const insertChannelMock = jest.fn().mockResolvedValue({ error: null });
    templateChannelViewsTable.insert!.mockImplementation(insertChannelMock);

    blocksToMasterContentMock.mockReturnValue("Content");
    blocksToHTMLMock.mockReturnValue("<p>Content</p>");

    const { result } = renderHook(() => useTemplateBuilder());

    await act(async () => {
      result.current.updateTemplate(publishTemplateData);
    });

    await act(async () => {
      const published = await result.current.publishTemplate();
      expect(published?.status).toBe("published");
    });

    expect(messageTemplatesTable.insert).toHaveBeenCalledWith(
      expect.objectContaining({ is_active: true })
    );
    expect(toastMock).toHaveBeenCalledWith({
      title: "Published",
      description: "Template published successfully",
    });
  });
});
