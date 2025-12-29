import { render, screen } from "@/utils/testUtils";
import { StorageWidget } from "../storage-widget";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      if (options && typeof options === "object") {
        if (typeof options.percent === "number") return `${key}:${options.percent}`;
        if (typeof options.total === "string") return `${key}:${options.total}`;
      }
      return key;
    },
    i18n: { language: "en", resolvedLanguage: "en" },
  }),
}));

describe("StorageWidget", () => {
  it("shows critical status at >= 75%", () => {
    render(<StorageWidget usedBytes={80} totalBytes={100} />);
    expect(screen.getByText("storage.widget.status.critical")).toBeInTheDocument();
    expect(screen.getByText("storage.widget.percentFull:80")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "storage.widget.aria.progress" })).toBeInTheDocument();
  });

  it("shows near-limit status at >= 90% and < 100%", () => {
    render(<StorageWidget usedBytes={95} totalBytes={100} />);
    expect(screen.getByText("storage.widget.status.nearLimit")).toBeInTheDocument();
  });

  it("shows blocked copy when over limit", () => {
    render(<StorageWidget usedBytes={120} totalBytes={100} />);
    expect(screen.getByText("storage.widget.status.limitExceeded")).toBeInTheDocument();
    expect(screen.getByText("storage.widget.blocked")).toBeInTheDocument();
  });
});

