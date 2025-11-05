import React from "react";
import { fireEvent, render, screen, waitFor } from "@/utils/testUtils";
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

jest.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock("@/components/ui/switch", () => ({
  Switch: ({ checked, onCheckedChange }: { checked: boolean; onCheckedChange: (value: boolean) => void }) => (
    <button onClick={() => onCheckedChange(!checked)} data-testid="language-toggle">
      {checked ? "on" : "off"}
    </button>
  ),
}));

jest.mock("@/components/ui/segmented-control", () => ({
  SegmentedControl: ({ value, onValueChange, options }: SegmentedControlProps) => (
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
  ),
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

type SupabaseQueryChain = {
  select: jest.Mock<SupabaseQueryChain, [string?]>;
  order: jest.Mock<Promise<{ data: unknown[] }> | SupabaseQueryChain, [unknown?]>;
  eq: jest.Mock<SupabaseQueryChain, [string, unknown]>;
  update: jest.Mock;
  maybeSingle: jest.Mock;
  insert: jest.Mock;
};

type SupabaseFromMock = jest.Mock<SupabaseQueryChain, [string]>;

const supabaseMock = mockSupabaseClient as unknown as {
  from: SupabaseFromMock;
};

const mockUseTranslationFiles = useTranslationFiles as jest.MockedFunction<typeof useTranslationFiles>;

const languagesData = [
  { id: "en", name: "English", code: "en", native_name: "English", is_active: true, is_default: true },
  { id: "tr", name: "Turkish", code: "tr", native_name: "Türkçe", is_active: false, is_default: false },
];

const namespacesData = [
  { id: "pages", name: "pages" },
  { id: "common", name: "common" },
];

const translationKeysData = [
  { id: "key1", namespace_id: "pages", key_name: "welcome" },
  { id: "key2", namespace_id: "common", key_name: "hello" },
];

const translationsData = [
  { id: "t1", key_id: "key1", language_code: "en", value: "Welcome" },
];

const createQueryChain = (table: string): SupabaseQueryChain => {
  const chain: SupabaseQueryChain = {
    select: jest.fn<SupabaseQueryChain, [string?]>(),
    order: jest.fn<Promise<{ data: unknown[] }> | SupabaseQueryChain, [unknown?]>(),
    eq: jest.fn<SupabaseQueryChain, [string, unknown]>(),
    update: jest.fn(),
    maybeSingle: jest.fn(),
    insert: jest.fn(),
  };

  chain.select.mockReturnValue(chain);
  chain.order.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);

  if (table === "languages") {
    chain.order.mockResolvedValue({ data: languagesData });
    chain.update.mockImplementation(() => ({
      eq: jest.fn().mockResolvedValue({ error: null }),
    }));
  } else if (table === "translation_namespaces") {
    chain.order.mockResolvedValue({ data: namespacesData });
  } else if (table === "translation_keys") {
    chain.order.mockResolvedValue({ data: translationKeysData });
  } else if (table === "translations") {
    chain.select.mockResolvedValue({ data: translationsData });
  }

  return chain;
};

describe("Admin Localization page", () => {
  beforeEach(() => {
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

    supabaseMock.from = jest.fn((table: string) => createQueryChain(table));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("loads languages when the languages segment is selected", async () => {
    render(<AdminLocalization />);

    const languagesSegment = await screen.findByTestId("segment-languages");
    fireEvent.click(languagesSegment);

    await waitFor(() => {
      expect(supabaseMock.from).toHaveBeenCalledWith("languages");
    });

    expect(await screen.findAllByText("English")).not.toHaveLength(0);
    expect(await screen.findAllByText("Turkish")).not.toHaveLength(0);
  });

  it("updates a language when toggled", async () => {
    render(<AdminLocalization />);

    const languagesSegment = await screen.findByTestId("segment-languages");
    fireEvent.click(languagesSegment);

    await screen.findAllByText("English");

    const toggleButtons = screen.getAllByTestId("language-toggle");
   fireEvent.click(toggleButtons[1]);

    const fromMock = supabaseMock.from;
    const languagesQuery = fromMock.mock.results
      .map((result) => result.value)
      .find(
        (value): value is SupabaseQueryChain =>
          Boolean(value?.update.mock.calls.length)
      );

    await waitFor(() => {
      expect(languagesQuery?.update).toHaveBeenCalledWith({ is_active: true });
    });
  });
});
