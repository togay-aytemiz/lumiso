import { fireEvent, render, screen } from "@/utils/testUtils";
import { FeatureFAQSheet } from "../FeatureFAQSheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { searchFeatureFaq } from "@/data/featureFaq";

jest.mock("@/hooks/use-mobile", () => ({
  useIsMobile: jest.fn(),
}));

jest.mock("@/data/featureFaq", () => {
  const categories = [
    {
      category: "Başlarken",
      entries: [
        {
          id: "start-1",
          question: "Stüdyonu Tanıyalım formu nedir?",
          answer: "Yeni hesap açarken karşınıza çıkan ilk formdur.",
        },
      ],
    },
    {
      category: "Ödemeler ve Kapora",
      entries: [
        {
          id: "payments-1",
          question: "Kapora takibi nasıl işler?",
          answer: "Ödeme kartından ilerleyebilirsiniz.",
        },
      ],
    },
  ];

  return {
    featureFaqCategories: categories,
    searchFeatureFaq: jest.fn().mockReturnValue([
      {
        id: "payments-1",
        question: "Kapora takibi nasıl işler?",
        answer: "Ödeme kartından ilerleyebilirsiniz.",
        category: "Ödemeler ve Kapora",
      },
    ]),
  };
});

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      if (key === "help.faq_sheet.question_count" || key === "help.faq_sheet.search_results") {
        return `${options?.count} items`;
      }
      return key;
    },
  }),
}));

const useIsMobileMock = useIsMobile as jest.Mock;
const searchFeatureFaqMock = searchFeatureFaq as jest.Mock;

describe("FeatureFAQSheet", () => {
  beforeEach(() => {
    useIsMobileMock.mockReturnValue(false);
    jest.clearAllMocks();
  });

  it("renders categories and allows navigating into a category accordion", () => {
    render(<FeatureFAQSheet open onOpenChange={jest.fn()} />);

    expect(screen.getByText("Başlarken")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /başlarken/i }));

    expect(screen.getByText("Stüdyonu Tanıyalım formu nedir?")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Stüdyonu Tanıyalım formu nedir?"));
    expect(screen.getByText("Yeni hesap açarken karşınıza çıkan ilk formdur.")).toBeInTheDocument();
  });

  it("shows search results with accordion items", () => {
    render(<FeatureFAQSheet open onOpenChange={jest.fn()} />);
    searchFeatureFaqMock.mockReturnValue([
      {
        id: "search-1",
        question: "Nasıl arama yaparım?",
        answer: "Arama kutusuna yazmanız yeterli.",
        category: "Arama ve Mobil Deneyim",
      },
    ]);

    const input = screen.getByPlaceholderText("help.faq_sheet.search_placeholder");
    fireEvent.change(input, { target: { value: "arama" } });

    expect(searchFeatureFaqMock).toHaveBeenCalledWith("arama");
    expect(screen.getByText("Nasıl arama yaparım?")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Nasıl arama yaparım?"));
    expect(screen.getByText("Arama kutusuna yazmanız yeterli.")).toBeInTheDocument();
  });
});
