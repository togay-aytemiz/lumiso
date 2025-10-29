import { fireEvent, render, screen, waitFor } from "@/utils/testUtils";
import { InlineSubjectEditor } from "../InlineSubjectEditor";
import { InlinePreheaderEditor } from "../InlinePreheaderEditor";
import { getCharacterCount, checkSpamWords } from "@/lib/templateUtils";

jest.mock("@/components/template-builder/EmojiPicker", () => ({
  EmojiPicker: ({ onEmojiSelect }: { onEmojiSelect: (emoji: string) => void }) => (
    <button type="button" onClick={() => onEmojiSelect("😊")}>
      Add emoji
    </button>
  ),
}));

jest.mock("@/components/template-builder/VariablePicker", () => ({
  VariablePicker: ({ onVariableSelect }: { onVariableSelect: (value: string) => void }) => (
    <button type="button" onClick={() => onVariableSelect("{first_name}")}>
      Insert variable
    </button>
  ),
}));

jest.mock("@/lib/templateUtils", () => ({
  getCharacterCount: jest.fn(),
  checkSpamWords: jest.fn(),
}));

const getCharacterCountMock = getCharacterCount as jest.Mock;
const checkSpamWordsMock = checkSpamWords as jest.Mock;

beforeEach(() => {
  getCharacterCountMock.mockReturnValue(0);
  checkSpamWordsMock.mockReturnValue([]);
});

describe("InlineSubjectEditor", () => {
  it("saves trimmed subject when submitting with Enter", async () => {
    const handleSave = jest.fn().mockResolvedValue(undefined);
    const handleCancel = jest.fn();

    render(
      <InlineSubjectEditor value="Initial" onSave={handleSave} onCancel={handleCancel} />
    );

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "  Updated subject  " } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(handleSave).toHaveBeenCalledWith("Updated subject");
    });
  });

  it("displays character count and spam word warnings", () => {
    getCharacterCountMock.mockReturnValue(65);
    checkSpamWordsMock.mockReturnValue(["free", "winner", "cash"]);

    render(
      <InlineSubjectEditor value="Promo" onSave={jest.fn()} onCancel={jest.fn()} />
    );

    expect(screen.getByText("65/60 characters (too long)")).toBeInTheDocument();
    expect(screen.getByText("Spam words:")).toBeInTheDocument();
    expect(screen.getByText("free")).toBeInTheDocument();
    expect(screen.getByText("winner")).toBeInTheDocument();
    expect(screen.getByText("+1 more")).toBeInTheDocument();
  });

  it("appends variables and emojis via picker helpers", () => {
    render(
      <InlineSubjectEditor value="" onSave={jest.fn()} onCancel={jest.fn()} />
    );

    const input = screen.getByRole("textbox") as HTMLInputElement;

    fireEvent.click(screen.getByRole("button", { name: "Insert variable" }));
    expect(input.value).toContain("{first_name}");

    fireEvent.click(screen.getByRole("button", { name: "Add emoji" }));
    expect(input.value).toContain("😊");
  });
});

describe("InlinePreheaderEditor", () => {
  it("auto-saves on blur when the value changes", async () => {
    const handleSave = jest.fn().mockResolvedValue(undefined);

    render(
      <InlinePreheaderEditor value="Old preheader" onSave={handleSave} onCancel={jest.fn()} />
    );

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: " Refined preheader " } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(handleSave).toHaveBeenCalledWith("Refined preheader");
    });
  });

  it("cancels editing when escape is pressed", () => {
    const handleCancel = jest.fn();

    render(
      <InlinePreheaderEditor value="Content" onSave={jest.fn()} onCancel={handleCancel} />
    );

    const input = screen.getByRole("textbox");
    fireEvent.keyDown(input, { key: "Escape" });

    expect(handleCancel).toHaveBeenCalled();
  });
});
