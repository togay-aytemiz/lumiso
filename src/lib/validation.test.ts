import {
  emailSchema,
  passwordSchema,
  phoneSchema,
  nameSchema,
  notesSchema,
  signInSchema,
  signUpSchema,
  leadSchema,
  sessionSchema,
  sanitizeInput,
  sanitizeHtml,
} from "./validation";
import DOMPurify from "dompurify";

jest.mock("dompurify", () => ({
  __esModule: true,
  default: {
    sanitize: jest.fn((value: string) => `sanitized:${value}`),
  },
}));

describe("validation schemas", () => {
  describe("emailSchema", () => {
    it("accepts valid emails and rejects invalid ones", () => {
      expect(emailSchema.parse("user@example.com")).toBe("user@example.com");
      expect(() => emailSchema.parse("not-an-email")).toThrow();
    });

    it("enforces maximum length", () => {
      const longEmail = `${"a".repeat(250)}@example.com`;
      expect(() => emailSchema.parse(longEmail)).toThrow();
    });
  });

  describe("passwordSchema", () => {
    it("requires length and mixed characters", () => {
      expect(passwordSchema.parse("Aa123456")).toBe("Aa123456");
      expect(() => passwordSchema.parse("short")).toThrow();
      expect(() => passwordSchema.parse("alllowercase1")).toThrow();
    });
  });

  describe("phoneSchema", () => {
    it("allows optional values and enforces E.164 pattern", () => {
      expect(phoneSchema.parse(undefined)).toBeUndefined();
      expect(phoneSchema.parse("+905551234567")).toBe("+905551234567");
      expect(() => phoneSchema.parse("abc")).toThrow();
    });
  });

  describe("nameSchema", () => {
    it("requires non-empty names with valid characters", () => {
      expect(nameSchema.parse("Tayte Emiz")).toBe("Tayte Emiz");
      expect(() => nameSchema.parse("")).toThrow();
      expect(() => nameSchema.parse("Name!")).toThrow();
    });
  });

  describe("notesSchema", () => {
    it("allows undefined and enforces max length", () => {
      expect(notesSchema.parse(undefined)).toBeUndefined();
      expect(notesSchema.parse("Notes")).toBe("Notes");
      expect(() => notesSchema.parse("a".repeat(1001))).toThrow();
    });
  });

  describe("auth schemas", () => {
    it("validates sign-in payloads", () => {
      expect(
        signInSchema.parse({ email: "user@example.com", password: "secret" })
      ).toEqual({ email: "user@example.com", password: "secret" });
      expect(() =>
        signInSchema.parse({ email: "bad", password: "" })
      ).toThrow();
    });

    it("validates sign-up payloads against password policy", () => {
      expect(
        signUpSchema.parse({ email: "user@example.com", password: "Aa123456" })
      ).toEqual({ email: "user@example.com", password: "Aa123456" });
      expect(() =>
        signUpSchema.parse({ email: "user@example.com", password: "weak" })
      ).toThrow();
    });
  });

  describe("entity schemas", () => {
    it("validates lead payload", () => {
      expect(
        leadSchema.parse({
          name: "Client",
          email: "client@example.com",
          phone: "+905551234567",
          notes: "Interested in portraits",
        })
      ).toBeTruthy();
      expect(() =>
        leadSchema.parse({ name: "", email: "client@example.com" })
      ).toThrow();
    });

    it("validates session payload", () => {
      expect(
        sessionSchema.parse({
          session_date: "2025-01-01",
          session_time: "09:00",
          notes: "Bring props",
        })
      ).toBeTruthy();
      expect(() =>
        sessionSchema.parse({ session_date: "", session_time: "" })
      ).toThrow();
    });
  });
});

describe("sanitize helpers", () => {
  it("trims and strips angle brackets with sanitizeInput", () => {
    expect(sanitizeInput("  <script>alert('x')</script> ")).toBe(
      "scriptalert('x')/script"
    );
  });

  it("uses DOMPurify when available", async () => {
    const result = await sanitizeHtml("<div>unsafe</div>");
    const sanitizeMock = (DOMPurify as unknown as { sanitize: jest.Mock })
      .sanitize;

    expect(sanitizeMock).toHaveBeenCalledWith("<div>unsafe</div>");
    expect(result).toBe("sanitized:<div>unsafe</div>");
  });
});
