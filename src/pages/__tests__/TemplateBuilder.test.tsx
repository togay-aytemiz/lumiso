import React from "react";
import { fireEvent, render, screen, waitFor } from "@/utils/testUtils";
import TemplateBuilder from "../TemplateBuilder";
import { mockSupabaseClient } from "@/utils/testUtils";
import { useTemplateBuilder } from "@/hooks/useTemplateBuilder";

jest.mock("@/integrations/supabase/client", () => ({
  supabase: mockSupabaseClient,
}));

jest.mock("@/components/template-builder/OptimizedTemplateEditor", () => ({
  OptimizedTemplateEditor: ({ onBlocksChange }: { onBlocksChange: (blocks: any[]) => void }) => (
    <div>
      <button type="button" onClick={() => onBlocksChange([{ id: "block-1" }])}>
        update-blocks
      </button>
    </div>
  ),
}));

jest.mock("@/components/template-builder/OptimizedTemplatePreview", () => ({
  OptimizedTemplatePreview: () => <div data-testid="template-preview" />,
}));

jest.mock("@/components/template-builder/InlineSubjectEditor", () => ({
  InlineSubjectEditor: ({ onSave }: { onSave: (value: string) => void }) => (
    <button type="button" onClick={() => onSave("Updated subject")}>save-subject</button>
  ),
}));

jest.mock("@/components/template-builder/InlinePreheaderEditor", () => ({
  InlinePreheaderEditor: ({ onSave }: { onSave: (value: string) => void }) => (
    <button type="button" onClick={() => onSave("Updated preheader")}>save-preheader</button>
  ),
}));

jest.mock("@/components/template-builder/TemplateNameDialog", () => ({
  TemplateNameDialog: () => null,
}));

jest.mock("@/components/settings/NavigationGuardDialog", () => ({
  NavigationGuardDialog: () => null,
}));

jest.mock("@/components/template-builder/TemplateErrorBoundary", () => ({
  TemplateErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock("@/components/ui/button", () => {
  const React = require("react");
  const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
    ({ children, ...props }, ref) => (
      <button ref={ref} {...props}>
        {children}
      </button>
    )
  );
  Button.displayName = "Button";
  return {
    __esModule: true,
    Button,
  };
});

jest.mock("@/components/ui/input", () => ({
  Input: ({ value, onChange, onBlur, onKeyDown }: any) => (
    <input
      value={value}
      onChange={(event) => onChange?.(event)}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
    />
  ),
}));

jest.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

jest.mock("@/components/ui/label", () => ({
  Label: ({ children }: { children: React.ReactNode }) => <label>{children}</label>,
}));

jest.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

jest.mock("@/hooks/useTemplateBuilder");
jest.mock("@/hooks/useTemplateVariables", () => ({
  useTemplateVariables: jest.fn(() => ({
    getVariableValue: jest.fn(),
  })),
}));

jest.mock("@/hooks/useSettingsNavigation", () => ({
  useSettingsNavigation: () => ({
    showGuard: false,
    message: "",
    handleNavigationAttempt: jest.fn(() => true),
    handleDiscardChanges: jest.fn(),
    handleStayOnPage: jest.fn(),
    handleSaveAndExit: jest.fn(),
  }),
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: any) =>
      options?.time ? `${key}-${options.time}` : key,
    i18n: { language: "en" },
  }),
}));

const mockUseTemplateBuilder = useTemplateBuilder as jest.MockedFunction<typeof useTemplateBuilder>;

const baseTemplate = {
  id: "template-1",
  name: "Welcome",
  subject: "Hello",
  preheader: "Preheader",
  blocks: [],
  status: "draft" as const,
  category: "general",
};

describe("TemplateBuilder page", () => {
  beforeEach(() => {
    jest.spyOn(require("react-router-dom"), "useNavigate").mockReturnValue(jest.fn());
    jest.spyOn(require("react-router-dom"), "useSearchParams").mockReturnValue([new URLSearchParams("id=template-1"), jest.fn()]);

    mockSupabaseClient.from = jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      neq: jest.fn().mockResolvedValue({ data: [] }),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn(),
    }));
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it("renders a loading indicator while template data is loading", () => {
    mockUseTemplateBuilder.mockReturnValue({
      template: null,
      loading: true,
      saving: false,
      lastSaved: null,
      isDirty: false,
      saveTemplate: jest.fn(),
      publishTemplate: jest.fn(),
      updateTemplate: jest.fn(),
      resetDirtyState: jest.fn(),
    });

    render(<TemplateBuilder />);

    expect(screen.getByText("templateBuilder.loading")).toBeInTheDocument();
  });

  it("saves the current template when the save button is clicked", async () => {
    const saveTemplate = jest.fn().mockResolvedValue(baseTemplate);
    const updateTemplate = jest.fn();

    mockUseTemplateBuilder.mockReturnValue({
      template: baseTemplate,
      loading: false,
      saving: false,
      lastSaved: null,
      isDirty: true,
      saveTemplate,
      publishTemplate: jest.fn(),
      updateTemplate,
      resetDirtyState: jest.fn(),
    });

    render(<TemplateBuilder />);

    fireEvent.click(screen.getByText("templateBuilder.buttons.saveDraft"));

    await waitFor(() => {
      expect(saveTemplate).toHaveBeenCalledWith({
        ...baseTemplate,
        name: "Welcome",
        subject: "Hello",
        preheader: "Preheader",
        blocks: [],
      });
    });
  });

  it("updates template blocks when the editor reports changes", async () => {
    const updateTemplate = jest.fn();

    mockUseTemplateBuilder.mockReturnValue({
      template: baseTemplate,
      loading: false,
      saving: false,
      lastSaved: null,
      isDirty: true,
      saveTemplate: jest.fn(),
      publishTemplate: jest.fn(),
      updateTemplate,
      resetDirtyState: jest.fn(),
    });

    render(<TemplateBuilder />);

    fireEvent.click(screen.getByText("update-blocks"));

    await waitFor(() => {
      expect(updateTemplate).toHaveBeenCalledWith({ blocks: [{ id: "block-1" }] });
    });
  });
});
