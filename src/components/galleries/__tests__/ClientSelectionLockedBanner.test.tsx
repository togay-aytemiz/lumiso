import { render, screen } from "@/utils/testUtils";
import i18n from "@/i18n";
import { ClientSelectionLockedBanner } from "../ClientSelectionLockedBanner";

describe("ClientSelectionLockedBanner", () => {
  const previousLanguage = i18n.language;

  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  afterAll(async () => {
    await i18n.changeLanguage(previousLanguage);
  });

  it("shows the client note when provided", () => {
    render(<ClientSelectionLockedBanner note="Please retouch this one." />);

    expect(screen.getByText("YOUR NOTE")).toBeInTheDocument();
    expect(screen.getByText("Please retouch this one.")).toBeInTheDocument();
  });

  it("hides the note section when note is empty", () => {
    render(<ClientSelectionLockedBanner note="   " />);

    expect(screen.queryByText("YOUR NOTE")).not.toBeInTheDocument();
  });
});

