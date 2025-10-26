import React from "react";
import { render, screen, fireEvent, waitFor } from "@/utils/testUtils";
import { PlainTextPreview } from "../PlainTextPreview";
import { TemplatePreview } from "../TemplatePreview";
import { OptimizedTemplatePreview } from "../OptimizedTemplatePreview";

const toastMock = jest.fn();
const emailPreviewMock = jest.fn();

jest.mock("@/hooks/use-toast", () => ({
  useToast: jest.fn(() => ({ toast: toastMock })),
  toast: (...args: unknown[]) => toastMock(...args),
}));

jest.mock("../previews/EmailPreview", () => ({
  EmailPreview: (props: any) => {
    emailPreviewMock(props);
    return <div data-testid="email-preview" />;
  },
}));

jest.mock("../previews/WhatsAppPreview", () => ({
  WhatsAppPreview: () => <div data-testid="whatsapp-preview" />,
}));

jest.mock("../previews/SMSPreview", () => ({
  SMSPreview: () => <div data-testid="sms-preview" />,
}));

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: jest.fn(() => ({ user: { email: "user@example.com" } })),
}));

jest.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: jest.fn(),
    },
  },
}));

jest.mock("@/contexts/OrganizationContext", () => ({
  useOrganization: jest.fn(() => ({ activeOrganization: { id: "org-1" } })),
}));

jest.mock("@/hooks/useOrganizationSettings", () => ({
  useOrganizationSettings: jest.fn(() => ({ settings: null })),
}));

jest.mock("react-i18next", () => ({
  useTranslation: jest.fn(() => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options && "name" in options
        ? `${key}:${(options as any).name}`
        : key,
    i18n: { language: "en" },
  })),
}));

jest.mock("@/lib/utils", () => ({
  cn: (...classes: string[]) => classes.filter(Boolean).join(" "),
}));

jest.mock("@/components/ui/tabs", () => ({
  Tabs: ({ value, onValueChange, children }: any) => (
    <div data-testid="tabs" data-value={value}>
      {React.Children.map(children, (child: React.ReactElement) =>
        React.isValidElement(child)
          ? React.cloneElement(child, { onValueChange })
          : child
      )}
    </div>
  ),
  TabsList: ({ children }: any) => <div>{children}</div>,
  TabsTrigger: ({ value, children, onValueChange }: any) => (
    <button type="button" onClick={() => onValueChange?.(value)}>
      {children}
    </button>
  ),
  TabsContent: ({ children }: any) => <div>{children}</div>,
}));

const supabase = require("@/integrations/supabase/client").supabase;
const { useAuth } = require("@/contexts/AuthContext");

beforeEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(navigator, "clipboard", {
    value: {
      writeText: jest.fn().mockResolvedValue(undefined),
    },
    configurable: true,
  });
});

describe("PlainTextPreview", () => {

  it("copies generated plain text to the clipboard", async () => {
    render(
      <PlainTextPreview
        blocks={[
          { id: "1", type: "text", data: { content: "Hello" }, visible: true },
        ] as any}
        mockData={{ customer_name: "Taylor" }}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Copy plain text preview" })
    );

    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalled()
    );
    expect(toastMock).toHaveBeenCalledWith({
      title: "Copied to clipboard",
      description: "Plain text version has been copied to your clipboard.",
    });
  });
});

describe("TemplatePreview", () => {
  const baseBlocks = [
    {
      id: "1",
      type: "text",
      data: {
        content: "Hello {customer_name}",
        formatting: {
          fontFamily: "Arial",
          fontSize: "p",
          bold: false,
          italic: false,
          bullets: false,
          alignment: "left",
        },
      },
      visible: true,
    },
    {
      id: "2",
      type: "cta",
      data: { text: "Book Now", variant: "primary", url: "https://example.com" },
      visible: false,
    },
  ] as any;

  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({ user: { email: "user@example.com" } });
  });

  it("renders the active channel and toggles devices for email", () => {
    render(
      <TemplatePreview
        blocks={baseBlocks}
        activeChannel="email"
        onChannelChange={jest.fn()}
        emailSubject="Subject"
        preheader="Preheader"
        previewData={{}}
      />
    );

    expect(screen.getByTestId("email-preview")).toBeInTheDocument();

    const desktopButton = screen.getByRole("button", {
      name: "templateBuilder.preview.desktop",
    });
    const mobileButton = screen.getByRole("button", {
      name: "templateBuilder.preview.mobile",
    });

    expect(desktopButton.className).toContain("bg-primary");
    expect(mobileButton.className).not.toContain("bg-primary");

    fireEvent.click(
      screen.getByRole("button", {
        name: "templateBuilder.preview.mobile",
      })
    );

    expect(mobileButton.className).toContain("bg-primary");
  });

  it("renders the selected channel preview", () => {
    const { rerender } = render(
      <TemplatePreview
        blocks={baseBlocks}
        activeChannel="email"
        onChannelChange={jest.fn()}
        emailSubject="Subject"
        preheader="Preheader"
        previewData={{}}
      />
    );

    expect(screen.getByTestId("email-preview")).toBeInTheDocument();

    rerender(
      <TemplatePreview
        blocks={baseBlocks}
        activeChannel="whatsapp"
        onChannelChange={jest.fn()}
        emailSubject="Subject"
        preheader="Preheader"
        previewData={{}}
      />
    );

    expect(screen.getByTestId("whatsapp-preview")).toBeInTheDocument();
  });

  it("sends a test email and shows success toast", async () => {
    (supabase.functions.invoke as jest.Mock).mockResolvedValue({
      data: {},
      error: null,
    });

    render(
      <TemplatePreview
        blocks={baseBlocks}
        activeChannel="email"
        onChannelChange={jest.fn()}
        emailSubject="Subject"
        preheader="Preheader"
        previewData={{}}
      />
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "templateBuilder.preview.testSend",
      })
    );

    await waitFor(() => expect(supabase.functions.invoke).toHaveBeenCalled());
    const [functionName, payload] = (supabase.functions.invoke as jest.Mock).mock.calls[0];
    expect(functionName).toBe("send-template-email");
    expect(payload.body.to).toBe("user@example.com");
    expect(payload.body.blocks).toHaveLength(1);

    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "templateBuilder.preview.toast.successTitle",
      })
    );
  });

  it("shows an error toast when no user email is available", () => {
    (useAuth as jest.Mock).mockReturnValue({ user: { email: null } });

    render(
      <TemplatePreview
        blocks={baseBlocks}
        activeChannel="email"
        onChannelChange={jest.fn()}
        emailSubject="Subject"
        preheader="Preheader"
        previewData={{}}
      />
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "templateBuilder.preview.testSend",
      })
    );

    expect(supabase.functions.invoke).not.toHaveBeenCalled();
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        description: "templateBuilder.preview.toast.noUserEmail",
        variant: "destructive",
      })
    );
  });

  it("surfaces errors from the Supabase invocation", async () => {
    (supabase.functions.invoke as jest.Mock).mockResolvedValue({
      data: null,
      error: { message: "Send failed" },
    });

    render(
      <TemplatePreview
        blocks={baseBlocks}
        activeChannel="email"
        onChannelChange={jest.fn()}
        emailSubject="Subject"
        preheader="Preheader"
        previewData={{}}
      />
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "templateBuilder.preview.testSend",
      })
    );

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          description: "Send failed",
          variant: "destructive",
        })
      )
    );
  });
});

describe("OptimizedTemplatePreview", () => {
  it("renders the underlying TemplatePreview with the provided props", () => {
    render(
      <OptimizedTemplatePreview
        blocks={[{ id: "1", type: "text", data: {}, visible: true }] as any}
        activeChannel="email"
        onChannelChange={jest.fn()}
        emailSubject="Optimized Subject"
        preheader="Optimized Preheader"
        previewData={{ customer_name: "Jordan" }}
      />
    );

    expect(screen.getByTestId("email-preview")).toBeInTheDocument();
  });
});
