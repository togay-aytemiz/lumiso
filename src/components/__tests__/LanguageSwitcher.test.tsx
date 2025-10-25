import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LanguageSwitcher } from "../LanguageSwitcher";
import { useLanguage } from "@/contexts/LanguageContext";

jest.mock("@/contexts/LanguageContext", () => ({
  useLanguage: jest.fn(),
}));

const mockUseLanguage = useLanguage as jest.MockedFunction<typeof useLanguage>;

describe("LanguageSwitcher", () => {
  beforeEach(() => {
    mockUseLanguage.mockReset();
  });

  it("renders the current language label and switches languages", async () => {
    const changeLanguage = jest.fn().mockResolvedValue(undefined);
    mockUseLanguage.mockReturnValue({
      currentLanguage: "en",
      availableLanguages: [
        { code: "en", native_name: "English", name: "English" },
        { code: "tr", native_name: "Türkçe", name: "Turkish" },
      ],
      changeLanguage,
      isLoading: false,
    });

    const user = userEvent.setup();
    render(<LanguageSwitcher />);

    const triggerButton = screen.getByRole("button", { name: /English/i });
    expect(triggerButton).toBeEnabled();

    await user.click(triggerButton);
    await user.click(screen.getByText("Türkçe"));

    expect(changeLanguage).toHaveBeenCalledWith("tr");
  });

  it("disables the trigger when languages are loading", () => {
    mockUseLanguage.mockReturnValue({
      currentLanguage: "en",
      availableLanguages: [
        { code: "en", native_name: "English", name: "English" },
      ],
      changeLanguage: jest.fn(),
      isLoading: true,
    });

    render(<LanguageSwitcher />);

    expect(screen.getByRole("button", { name: /English/i })).toBeDisabled();
  });

  it("disables the trigger while a language change is in progress", async () => {
    let resolveChange: () => void = () => undefined;
    const changeLanguage = jest.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveChange = resolve;
        })
    );

    mockUseLanguage.mockReturnValue({
      currentLanguage: "en",
      availableLanguages: [
        { code: "en", native_name: "English", name: "English" },
        { code: "tr", native_name: "Türkçe", name: "Turkish" },
      ],
      changeLanguage,
      isLoading: false,
    });

    const user = userEvent.setup();
    render(<LanguageSwitcher />);

    const triggerButton = screen.getByRole("button", { name: /English/i });
    await user.click(triggerButton);
    await user.click(screen.getByText("Türkçe"));

    expect(changeLanguage).toHaveBeenCalledWith("tr");
    expect(triggerButton).toBeDisabled();

    resolveChange();
    await waitFor(() => expect(triggerButton).toBeEnabled());
  });

  it("supports the compact variant", () => {
    mockUseLanguage.mockReturnValue({
      currentLanguage: "tr",
      availableLanguages: [
        { code: "en", native_name: "English", name: "English" },
        { code: "tr", native_name: "Türkçe", name: "Turkish" },
      ],
      changeLanguage: jest.fn(),
      isLoading: false,
    });

    render(<LanguageSwitcher variant="compact" />);

    expect(screen.getByText("TR")).toBeInTheDocument();
  });
});
