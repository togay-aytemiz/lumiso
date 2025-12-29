import { fireEvent, render, screen } from "@/utils/testUtils";
import i18n from "@/i18n";
import { SelectionLockBanner } from "../SelectionLockBanner";

describe("SelectionLockBanner", () => {
  const previousLanguage = i18n.language;

  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  afterAll(async () => {
    await i18n.changeLanguage(previousLanguage);
  });

  it("offers both unlock options when provided", async () => {
    const onUnlockForClient = jest.fn();
    const onUnlockForMe = jest.fn();

    render(
      <SelectionLockBanner
        status="locked"
        note="Client note"
        onExport={jest.fn()}
        onUnlockForClient={onUnlockForClient}
        onUnlockForMe={onUnlockForMe}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Unlock" }));

    const unlockForClient = await screen.findByRole("button", { name: "Unlock for client" });
    const unlockForMe = await screen.findByRole("button", { name: "Unlock just for me" });

    fireEvent.click(unlockForMe);
    expect(onUnlockForMe).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Unlock" }));
    fireEvent.click(await screen.findByRole("button", { name: "Unlock for client" }));
    expect(onUnlockForClient).toHaveBeenCalledTimes(1);
  });

  it("renders draft status without actions", () => {
    render(<SelectionLockBanner status="draft" />);

    expect(screen.getByText("Draft gallery")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Unlock" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Export selections" })).not.toBeInTheDocument();
  });
});
