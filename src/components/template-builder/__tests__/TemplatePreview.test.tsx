import React from "react";
import { fireEvent, render, screen, waitFor } from "@/utils/testUtils";
import { TemplatePreview } from "../TemplatePreview";
import { PlainTextPreview } from "../PlainTextPreview";
import { SMSPreview } from "../previews/SMSPreview";
import { WhatsAppPreview } from "../previews/WhatsAppPreview";
import { EmailPreview } from "../previews/EmailPreview";
import type { TemplateBlock } from "@/types/templateBuilder";

const toastMock = jest.fn();
const invokeMock = jest.fn();
const useAuthMock = jest.fn();
const useOrganizationSettingsMock = jest.fn(() => ({ settings: null }));
const generatePlainTextMock = jest.fn(() => "Plain text body");

jest.mock("@/hooks/use-toast", () => ({
  toast: (...args: unknown[]) => toastMock(...args),
  useToast: () => ({ toast: (...args: unknown[]) => toastMock(...args) }),
}));

jest.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => invokeMock(...args),
    },
  },
}));

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => useAuthMock(),
}));

jest.mock("@/hooks/useOrganizationSettings", () => ({
  useOrganizationSettings: () => useOrganizationSettingsMock(),
}));

jest.mock("@/lib/templateUtils", () => ({
  ...jest.requireActual("@/lib/templateUtils"),
  generatePlainText: (...args: unknown[]) => generatePlainTextMock(...args),
}));

jest.mock("@/components/ui/tabs", () => {
  const React = require("react");
  const TabsContext = React.createContext<{ onValueChange?: (value: string) => void }>({});

  const Tabs = ({
    onValueChange,
    children,
  }: {
    onValueChange?: (value: string) => void;
    children: React.ReactNode;
  }) => <TabsContext.Provider value={{ onValueChange }}>{children}</TabsContext.Provider>;

  const TabsList = ({ children, ...props }: { children: React.ReactNode }) => <div {...props}>{children}</div>;

  const TabsTrigger = ({
    value,
    children,
    ...props
  }: {
    value: string;
    children: React.ReactNode;
  } & React.ButtonHTMLAttributes<HTMLButtonElement>) => {
    const ctx = React.useContext(TabsContext);
    return (
      <button
        type="button"
        {...props}
        onClick={() => ctx.onValueChange?.(value)}
      >
        {children}
      </button>
    );
  };

  const TabsContent = ({ children, ...props }: { children: React.ReactNode }) => <div {...props}>{children}</div>;

  return {
    Tabs,
    TabsList,
    TabsTrigger,
    TabsContent,
  };
});

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      if (options?.name) return `${key}:${options.name}`;
      if (options?.email) return `${key}:${options.email}`;
      return key;
    },
    i18n: { language: "en", changeLanguage: jest.fn() },
  }),
}));

const clipboardWriteMock = jest.fn().mockResolvedValue(undefined);

beforeAll(() => {
  Object.assign(navigator, {
    clipboard: {
      writeText: clipboardWriteMock,
    },
  });
});

beforeEach(() => {
  toastMock.mockClear();
  invokeMock.mockReset().mockResolvedValue({ data: { ok: true }, error: null });
  clipboardWriteMock.mockClear();
  useOrganizationSettingsMock.mockReturnValue({ settings: null });
  useAuthMock.mockReturnValue({ user: { email: "user@example.com" } });
  generatePlainTextMock.mockReturnValue("Plain text body");
});

const sampleBlocks: TemplateBlock[] = [
  {
    id: "block-1",
    type: "text",
    visible: true,
    order: 0,
    data: {
      content: "Hello {customer_name}",
      formatting: {
        fontSize: "p",
      },
    },
  },
];

const previewData = {
  customer_name: "Alice Example",
  session_date: "Aug 12",
  session_time: "2:00 PM",
  session_location: "Studio 5",
  business_name: "Lumiso Studios",
  business_phone: "555-1234",
};

describe("TemplatePreview", () => {
  it("switches channels when tabs are selected", () => {
    const onChannelChange = jest.fn();

    render(
      <TemplatePreview
        blocks={sampleBlocks}
        activeChannel="email"
        onChannelChange={onChannelChange}
        previewData={previewData}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /templateBuilder\.preview\.channels\.whatsapp/ }));
    expect(onChannelChange).toHaveBeenCalledWith("whatsapp");

    fireEvent.click(screen.getByRole("button", { name: /templateBuilder\.preview\.channels\.sms/ }));
    expect(onChannelChange).toHaveBeenCalledWith("sms");
  });

  it("sends a test email when user has an email and blocks exist", async () => {
    render(
      <TemplatePreview
        blocks={sampleBlocks}
        activeChannel="email"
        onChannelChange={jest.fn()}
        emailSubject="Subject {customer_name}"
        preheader="Preheader"
        previewData={previewData}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /templateBuilder\.preview\.testSend/ }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(
        "send-template-email",
        expect.objectContaining({
          body: expect.objectContaining({
            to: "user@example.com",
            blocks: expect.arrayContaining([
              expect.objectContaining({ id: "block-1" }),
            ]),
          }),
        })
      );
    });

    expect(toastMock).toHaveBeenCalledWith({
      title: "templateBuilder.preview.toast.successTitle",
      description: "templateBuilder.preview.toast.testEmailSent:user@example.com",
    });
  });

  it("shows an error toast when no user email is present", () => {
    useAuthMock.mockReturnValue({ user: { email: null } });

    render(
      <TemplatePreview
        blocks={sampleBlocks}
        activeChannel="email"
        onChannelChange={jest.fn()}
        previewData={previewData}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /templateBuilder\.preview\.testSend/ }));

    expect(invokeMock).not.toHaveBeenCalled();
    expect(toastMock).toHaveBeenCalledWith({
      title: "templateBuilder.preview.toast.errorTitle",
      description: "templateBuilder.preview.toast.noUserEmail",
      variant: "destructive",
    });
  });

  it("disables test send when no blocks are present", () => {
    render(
      <TemplatePreview
        blocks={[]}
        activeChannel="email"
        onChannelChange={jest.fn()}
        previewData={previewData}
      />
    );

    const sendButton = screen.getByRole("button", { name: /templateBuilder\.preview\.testSend/ });
    expect(sendButton).toBeDisabled();
    fireEvent.click(sendButton);
    expect(invokeMock).not.toHaveBeenCalled();
    expect(toastMock).not.toHaveBeenCalled();
  });

  it("surfaces Supabase errors from sendTestEmail", async () => {
    invokeMock.mockResolvedValueOnce({ data: null, error: { message: "Send failed" } });

    render(
      <TemplatePreview
        blocks={sampleBlocks}
        activeChannel="email"
        onChannelChange={jest.fn()}
        previewData={previewData}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /templateBuilder\.preview\.testSend/ }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith({
        title: "templateBuilder.preview.toast.errorTitle",
        description: "Send failed",
        variant: "destructive",
      });
    });
  });

  it("switches email preview device between desktop and mobile", () => {
    render(
      <TemplatePreview
        blocks={sampleBlocks}
        activeChannel="email"
        onChannelChange={jest.fn()}
        previewData={previewData}
      />
    );

    const previewContainerBefore = document.querySelector(".mx-auto.transition-all");
    expect(previewContainerBefore?.className).toContain("max-w-2xl");

    fireEvent.click(screen.getByRole("button", { name: /templateBuilder\.preview\.mobile/ }));

    const previewContainerAfter = document.querySelector(".mx-auto.transition-all");
    expect(previewContainerAfter?.className).toContain("max-w-sm");
  });

  it("renders WhatsApp preview when channel is whatsapp", () => {
    render(
      <TemplatePreview
        blocks={sampleBlocks}
        activeChannel="whatsapp"
        onChannelChange={jest.fn()}
        previewData={previewData}
      />
    );

    expect(screen.getByText(/templateBuilder\.preview\.whatsapp\.online/)).toBeInTheDocument();
    expect(screen.getByText(/Hello 👋 Alice Example/)).toBeInTheDocument();
  });

  it("renders SMS preview when channel is sms", () => {
    render(
      <TemplatePreview
        blocks={sampleBlocks}
        activeChannel="sms"
        onChannelChange={jest.fn()}
        previewData={previewData}
      />
    );

    expect(screen.getByText(/templateBuilder\.preview\.sms\.label/)).toBeInTheDocument();
    expect(screen.getByText(/templateBuilder\.preview\.sms\.characters/)).toBeInTheDocument();
  });
});

describe("PlainTextPreview", () => {
  it("copies generated text to the clipboard", async () => {
    render(<PlainTextPreview blocks={sampleBlocks} mockData={previewData} />);

    fireEvent.click(screen.getByRole("button", { name: "Copy plain text preview" }));

    await waitFor(() => {
      expect(generatePlainTextMock).toHaveBeenCalled();
      expect(clipboardWriteMock).toHaveBeenCalledWith("Plain text body");
      expect(toastMock).toHaveBeenCalledWith({
        title: "Copied to clipboard",
        description: "Plain text version has been copied to your clipboard.",
      });
    });
  });
});

describe("SMSPreview", () => {
  it("displays character counts and long message warning", () => {
    const longText = "A".repeat(170);
    const smsBlock: TemplateBlock = {
      id: "sms-block",
      type: "text",
      visible: true,
      order: 0,
      data: {
        content: longText,
        formatting: { fontSize: "p" },
      },
    };

    render(<SMSPreview blocks={[smsBlock]} mockData={previewData} />);

    expect(screen.getByText(/170/)).toBeInTheDocument();
    expect(screen.getByText(/templateBuilder\.preview\.sms\.longMessageWarning/)).toBeInTheDocument();
  });
});

describe("WhatsAppPreview", () => {
  it("renders fallback content when no blocks are visible", () => {
    render(<WhatsAppPreview blocks={[]} mockData={previewData} />);

    expect(screen.getByText(/templateBuilder\.preview\.excitedMessage/)).toBeInTheDocument();
    expect(screen.getByText(/templateBuilder\.preview\.addBlocks/)).toBeInTheDocument();
  });
});

describe("EmailPreview", () => {
  it("replaces template variables in text blocks", () => {
    render(
      <EmailPreview
        blocks={sampleBlocks}
        mockData={previewData}
        device="desktop"
        emailSubject="Subject for {customer_name}"
        preheader="Preheader for {business_name}"
      />
    );

    expect(screen.getByText(/Hello Alice Example/)).toBeInTheDocument();
    expect(screen.getByText(/Subject for Alice Example/)).toBeInTheDocument();
    expect(screen.getByText(/Preheader for Lumiso Studios/)).toBeInTheDocument();
  });
});
