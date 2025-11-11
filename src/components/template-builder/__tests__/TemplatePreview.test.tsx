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

jest.mock("@/components/ui/segmented-control", () => ({
  SegmentedControl: ({ options, onValueChange }: { options: any[]; onValueChange: (value: string) => void }) => (
    <div>
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
      content: "Hello {lead_name}",
      formatting: {
        fontSize: "p",
      },
    },
  },
];

const previewData = {
  lead_name: "Alice Example",
  customer_name: "Alice Example",
  lead_email: "alice@example.com",
  lead_phone: "555-222-1111",
  lead_status: "Confirmed",
  lead_due_date: "Aug 30",
  lead_created_date: "Aug 1",
  lead_updated_date: "Aug 10",
  session_name: "Creative Session",
  session_type: "Portrait",
  session_duration: "45m",
  session_status: "Confirmed",
  session_date: "Aug 12",
  session_time: "2:00 PM",
  session_location: "Studio 5",
  session_meeting_url: "https://meet.example.com/session",
  session_notes: "Bring props",
  business_name: "Lumiso Studios",
  business_phone: "555-1234",
  project_name: "Brand Shoot",
  project_package_name: "Premium"
};

describe("TemplatePreview", () => {
  it("shows upcoming chips and keeps WhatsApp/SMS disabled", () => {
    const onChannelChange = jest.fn();

    render(
      <TemplatePreview
        blocks={sampleBlocks}
        activeChannel="email"
        onChannelChange={onChannelChange}
        previewData={previewData}
      />
    );

    const whatsappButton = screen.getByRole("button", { name: /templateBuilder\.preview\.channels\.whatsapp/ });
    const smsButton = screen.getByRole("button", { name: /templateBuilder\.preview\.channels\.sms/ });

    expect(whatsappButton).toBeDisabled();
    expect(smsButton).toBeDisabled();
    expect(screen.getAllByText(/templateBuilder\.preview\.channels\.soon/)).toHaveLength(2);

    fireEvent.click(whatsappButton);
    fireEvent.click(smsButton);
    expect(onChannelChange).not.toHaveBeenCalled();
  });

  it("sends a test email when user has an email and blocks exist", async () => {
    render(
      <TemplatePreview
        blocks={sampleBlocks}
        activeChannel="email"
        onChannelChange={jest.fn()}
        emailSubject="Subject {lead_name}"
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
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

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

    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it("renders live session details with mock data in EmailPreview", () => {
    const sessionBlock: TemplateBlock = {
      id: "session-1",
      type: "session-details",
      visible: true,
      order: 0,
      data: {
        showName: true,
        showType: true,
        showDuration: true,
        showStatus: true,
        showDate: true,
        showTime: true,
        showLocation: true,
        showMeetingLink: true,
        showProject: true,
        showPackage: true,
        showNotes: true,
      },
    };

    render(
      <EmailPreview
        blocks={[sessionBlock]}
        mockData={previewData}
        device="desktop"
        emailSubject="Subject"
      />
    );

    expect(screen.getByText("Creative Session")).toBeInTheDocument();
    expect(screen.getByText("Portrait")).toBeInTheDocument();
    expect(screen.getByText("45m")).toBeInTheDocument();
    expect(screen.getByText("Brand Shoot")).toBeInTheDocument();
    expect(screen.getByText("Bring props")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: previewData.session_meeting_url })).toBeInTheDocument();
  });

  it("injects the same data into SMSPreview text output", () => {
    const sessionBlock: TemplateBlock = {
      id: "session-2",
      type: "session-details",
      visible: true,
      order: 0,
      data: {
        showName: true,
        showNotes: true,
      },
    };

    render(<SMSPreview blocks={[sessionBlock]} mockData={previewData} />);

    expect(screen.getByText(/Creative Session/)).toBeInTheDocument();
    expect(screen.getByText(/Bring props/)).toBeInTheDocument();
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
        emailSubject="Subject for {lead_name}"
        preheader="Preheader for {business_name}"
      />
    );

    expect(screen.getByText(/Hello Alice Example/)).toBeInTheDocument();
    expect(screen.getByText(/Subject for Alice Example/)).toBeInTheDocument();
    expect(screen.getByText(/Preheader for Lumiso Studios/)).toBeInTheDocument();
  });

  it("applies the organization brand color to CTA buttons", () => {
    useOrganizationSettingsMock.mockReturnValue({
      settings: {
        primary_brand_color: "#842E5C",
      },
    });

    const ctaBlock: TemplateBlock = {
      id: "cta-1",
      type: "cta",
      visible: true,
      order: 1,
      data: {
        text: "Book Now",
        variant: "primary",
        link: "",
      },
    };

    render(
      <EmailPreview
        blocks={[ctaBlock]}
        mockData={previewData}
        device="desktop"
        emailSubject="Subject"
        preheader="Preheader"
      />
    );

    const button = screen.getByRole("button", { name: /Book Now/i });
    expect(button).toHaveStyle({ backgroundColor: "#842E5C" });
  });
});
