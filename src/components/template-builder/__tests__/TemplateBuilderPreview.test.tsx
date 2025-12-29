import type { ReactElement, ReactNode } from "react";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@/utils/testUtils";
import { PlainTextPreview } from "../PlainTextPreview";
import { TemplatePreview } from "../TemplatePreview";
import { OptimizedTemplatePreview } from "../OptimizedTemplatePreview";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { TemplateBlock } from "@/types/templateBuilder";
import type { SegmentedOption } from "@/components/ui/segmented-control";

const toastMock = jest.fn();
const emailPreviewMock = jest.fn();

jest.mock("@/hooks/use-toast", () => ({
  useToast: jest.fn(() => ({ toast: toastMock })),
  toast: (...args: unknown[]) => toastMock(...args),
}));

type EmailPreviewProps = {
  subject?: string;
  body?: string;
  [key: string]: unknown;
};

jest.mock("../previews/EmailPreview", () => ({
  EmailPreview: (props: EmailPreviewProps) => {
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
  useAuth: jest.fn(() => ({
    user: { email: "user@example.com" },
    session: { access_token: "test-token" },
  })),
}));

jest.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: jest.fn(),
    },
  },
}));

jest.mock("@/contexts/OrganizationContext", () => ({
  useOrganization: jest.fn(() => ({
    activeOrganizationId: "org-1",
    activeOrganization: { id: "org-1" },
  })),
}));

jest.mock("@/hooks/useOrganizationSettings", () => ({
  useOrganizationSettings: jest.fn(() => ({ settings: null, loading: false })),
}));

jest.mock("react-i18next", () => ({
  useTranslation: jest.fn(() => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options && "name" in options
        ? `${key}:${String(options.name)}`
        : key,
    i18n: { language: "en" },
  })),
}));

jest.mock("@/lib/utils", () => ({
  cn: (...classes: string[]) => classes.filter(Boolean).join(" "),
}));

jest.mock("@/components/ui/segmented-control", () => ({
  SegmentedControl: ({ options, onValueChange }: { options: SegmentedOption[]; onValueChange: (value: string) => void }) => (
    <div data-testid="segmented-control">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          disabled={option.disabled}
          onClick={() => {
            if (!option.disabled) {
              onValueChange(option.value);
            }
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  ),
}));

const clipboardWriteMock = jest.fn().mockResolvedValue(undefined);
const supabaseInvokeMock = supabase.functions.invoke as jest.MockedFunction<typeof supabase.functions.invoke>;
const useAuthMock = useAuth as jest.MockedFunction<typeof useAuth>;

beforeEach(() => {
  jest.clearAllMocks();
  clipboardWriteMock.mockClear();
  Object.defineProperty(navigator, "clipboard", {
    value: {
      writeText: clipboardWriteMock,
    },
    configurable: true,
  });
});

describe("PlainTextPreview", () => {

  it("copies generated plain text to the clipboard", async () => {
    const blocks: TemplateBlock[] = [
      { id: "1", type: "text", data: { content: "Hello" }, visible: true, order: 0 },
    ];
    render(
      <PlainTextPreview
        blocks={blocks}
        mockData={{ lead_name: "Taylor", customer_name: "Taylor" }}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Copy plain text preview" })
    );

    await waitFor(() =>
      expect(clipboardWriteMock).toHaveBeenCalled()
    );
    expect(toastMock).toHaveBeenCalledWith({
      title: "Copied to clipboard",
      description: "Plain text version has been copied to your clipboard.",
    });
  });
});

describe("TemplatePreview", () => {
  const baseBlocks: TemplateBlock[] = [
    {
      id: "1",
      type: "text",
      data: {
        content: "Hello {lead_name}",
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
      order: 0,
    },
    {
      id: "2",
      type: "cta",
      data: { text: "Book Now", variant: "primary", url: "https://example.com" },
      visible: false,
      order: 1,
    },
  ] as const;

  beforeEach(() => {
    jest.clearAllMocks();
    useAuthMock.mockReturnValue({
      user: { email: "user@example.com" },
      session: { access_token: "test-token" },
    });
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

    expect(desktopButton.className).toContain("bg-amber-200");
    expect(mobileButton.className).not.toContain("bg-amber");

    fireEvent.click(
      screen.getByRole("button", {
        name: "templateBuilder.preview.mobile",
      })
    );

    expect(mobileButton.className).toContain("bg-amber-200");
    expect(desktopButton.className).not.toContain("bg-amber");
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
    supabaseInvokeMock.mockResolvedValue({
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

    await waitFor(() => expect(supabaseInvokeMock).toHaveBeenCalled());
    const [functionName, payload] = supabaseInvokeMock.mock.calls[0];
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
    useAuthMock.mockReturnValue({
      user: { email: null },
      session: { access_token: "test-token" },
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

    expect(supabaseInvokeMock).not.toHaveBeenCalled();
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        description: "templateBuilder.preview.toast.noUserEmail",
        variant: "destructive",
      })
    );
  });

  it("surfaces errors from the Supabase invocation", async () => {
    supabaseInvokeMock.mockResolvedValue({
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
    const optimizedBlocks: TemplateBlock[] = [
      { id: "1", type: "text", data: {}, visible: true, order: 0 },
    ];
    render(
      <OptimizedTemplatePreview
        blocks={optimizedBlocks}
        activeChannel="email"
        onChannelChange={jest.fn()}
        emailSubject="Optimized Subject"
        preheader="Optimized Preheader"
        previewData={{ lead_name: "Jordan", customer_name: "Jordan" }}
      />
    );

    expect(screen.getByTestId("email-preview")).toBeInTheDocument();
  });
});
