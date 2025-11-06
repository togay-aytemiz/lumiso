import React from "react";
import { act, render, screen, waitFor } from "@/utils/testUtils";
import AdminLocalization from "../Localization";
import { useTranslationFiles } from "@/hooks/useTranslationFiles";
import { mockSupabaseClient } from "@/utils/testUtils";
import type { ReactNode } from "react";

jest.mock("@/integrations/supabase/client", () => ({
  supabase: mockSupabaseClient,
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { returnObjects?: boolean }) =>
      options?.returnObjects ? [] : key,
    i18n: { language: "en" },
  }),
}));

jest.mock("@/hooks/useTypedTranslation", () => ({
  useCommonTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock("@/hooks/use-toast", () => ({
  toast: jest.fn(),
}));

jest.mock("@/hooks/useTranslationFiles", () => ({
  useTranslationFiles: jest.fn(),
}));

jest.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <header>{children}</header>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  CardDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  CardContent: ({ children }: { children: React.ReactNode }) => <section>{children}</section>,
}));

jest.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

jest.mock("@/components/ui/button", () => {
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

type SegmentedControlOption = {
  label: string;
  value: string;
};

type SegmentedControlProps = {
  value: string;
  onValueChange: (value: string) => void;
  options: SegmentedControlOption[];
};

let setSegmentValue: ((value: string) => void) | undefined;
const switchHandlers: Array<(value: boolean) => void> = [];

jest.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock("@/components/ui/switch", () => ({
  Switch: ({ checked, onCheckedChange }: { checked: boolean; onCheckedChange: (value: boolean) => void }) => (
    <button
      onClick={() => onCheckedChange(!checked)}
      data-testid="language-toggle"
      data-handler-index={`${switchHandlers.push(onCheckedChange) - 1}`}
    >
      {checked ? "on" : "off"}
    </button>
  ),
}));

jest.mock("@/components/ui/segmented-control", () => ({
  SegmentedControl: ({ value, onValueChange, options }: SegmentedControlProps) => {
    setSegmentValue = onValueChange;
    return (
      <div>
        {options.map((option) => (
          <button
            key={option.value}
            data-testid={`segment-${option.value}`}
            aria-pressed={option.value === value}
            onClick={() => onValueChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    );
  },
}));

jest.mock("@/components/ui/table", () => ({
  Table: ({ children }: { children: React.ReactNode }) => <table>{children}</table>,
  TableHeader: ({ children }: { children: React.ReactNode }) => <thead>{children}</thead>,
  TableHead: ({ children }: { children: React.ReactNode }) => <th>{children}</th>,
  TableBody: ({ children }: { children: React.ReactNode }) => <tbody>{children}</tbody>,
  TableRow: ({ children }: { children: React.ReactNode }) => <tr>{children}</tr>,
  TableCell: ({ children }: { children: React.ReactNode }) => <td>{children}</td>,
}));

jest.mock("lucide-react", () => ({
  Globe: () => <span>globe</span>,
  Languages: () => <span>languages</span>,
  FileText: () => <span>filetext</span>,
  Upload: () => <span>upload</span>,
  Download: () => <span>download</span>,
  Plus: () => <span>plus</span>,
  Edit: () => <span>edit</span>,
  Trash: () => <span>trash</span>,
  Info: () => <span>info</span>,
  FileDown: () => <span>filedown</span>,
  Package: () => <span>package</span>,
}));

const mockUseTranslationFiles = useTranslationFiles as jest.MockedFunction<typeof useTranslationFiles>;

const languagesData = [
  { id: "en", name: "English", code: "en", native_name: "English", is_active: true, is_default: true },
  { id: "tr", name: "Turkish", code: "tr", native_name: "Türkçe", is_active: false, is_default: false },
];

const namespacesData = [
  { id: "pages", name: "pages" },
  { id: "common", name: "common" },
];

type LanguagesQuery = ReturnType<typeof createLanguagesQuery>;

let languagesQuery: LanguagesQuery;

function createLanguagesQuery() {
  const order = jest.fn().mockResolvedValue({ data: languagesData, error: null });
  const updateEq = jest.fn().mockResolvedValue({ error: null });

  return {
    select: jest.fn(() => ({ order })),
    order,
    update: jest.fn(() => ({ eq: updateEq })),
    updateEq,
  };
}

function createDefaultQuery() {
  const order = jest.fn().mockResolvedValue({ data: [], error: null });
  return {
    select: jest.fn(() => ({ order })),
    order,
    update: jest.fn(() => ({ eq: jest.fn().mockResolvedValue({ error: null }) })),
  };
}

describe("Admin Localization page", () => {
  beforeEach(() => {
    setSegmentValue = undefined;
    switchHandlers.length = 0;
    mockUseTranslationFiles.mockReturnValue({
      downloadLanguageFile: jest.fn(),
      downloadLanguagePack: jest.fn(),
      downloadAllTranslations: jest.fn(),
      uploadTranslationFile: jest.fn(),
      getAvailableLanguages: jest.fn(() => languagesData.map((language) => language.code)),
      getAvailableNamespaces: jest.fn(() => namespacesData.map((namespace) => namespace.name)),
      getNamespacesForLanguage: jest.fn(() => namespacesData.map((namespace) => namespace.name)),
      getTranslationStats: jest.fn(() => ({
        en: Object.fromEntries(namespacesData.map((namespace) => [namespace.name, 1])),
        tr: Object.fromEntries(namespacesData.map((namespace) => [namespace.name, 0])),
      })),
      isProcessing: false,
    });

    const fromMock = mockSupabaseClient.from as jest.Mock;
    fromMock.mockReset();

    languagesQuery = createLanguagesQuery();

    fromMock.mockImplementation((table: string) => {
      if (table === "languages") {
        return languagesQuery;
      }

      return createDefaultQuery();
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("loads languages when the languages segment is selected", async () => {
    render(<AdminLocalization />);

    await waitFor(() => {
      expect(screen.queryByText("admin.localization.loading")).not.toBeInTheDocument();
    });

    await screen.findByTestId("segment-languages");

    act(() => {
      setSegmentValue?.("languages");
    });

    await waitFor(() => {
      expect(mockSupabaseClient.from).toHaveBeenCalledWith("languages");
      expect(languagesQuery.order).toHaveBeenCalledWith("sort_order");
    });

    expect(await screen.findAllByText("English")).not.toHaveLength(0);
    expect(await screen.findAllByText("Turkish")).not.toHaveLength(0);
  });

  it("updates a language when toggled", async () => {
    render(<AdminLocalization />);

    await waitFor(() => {
      expect(screen.queryByText("admin.localization.loading")).not.toBeInTheDocument();
    });

    await screen.findByTestId("segment-languages");

    act(() => {
      setSegmentValue?.("languages");
    });

    await waitFor(() => {
      expect(languagesQuery.order).toHaveBeenCalledWith("sort_order");
    });

    await screen.findAllByText("English");

    const toggleButtons = await screen.findAllByTestId("language-toggle");

    const handlerIndex = Number(toggleButtons[1].getAttribute("data-handler-index"));

    act(() => {
      switchHandlers[handlerIndex]?.(true);
    });

    await waitFor(() => {
      expect(languagesQuery.update).toHaveBeenCalledWith({ is_active: true });
      expect(languagesQuery.updateEq).toHaveBeenCalledWith("id", "tr");
    });
  });
});
