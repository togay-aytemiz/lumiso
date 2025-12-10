import {
  createDynamicLeadSchema,
  sanitizeFieldValue,
  parseFieldValue,
  validateFieldValue,
} from "./leadFieldValidation";
import type { LeadFieldDefinition, LeadFieldType } from "@/types/leadFields";

function buildDefinition(
  overrides: Partial<LeadFieldDefinition>
): LeadFieldDefinition {
  return {
    id: overrides.id ?? "def",
    organization_id: overrides.organization_id ?? "org-1",
    field_key: overrides.field_key ?? "example",
    label: overrides.label ?? "Example",
    field_type: overrides.field_type ?? "text",
    is_system: overrides.is_system ?? false,
    is_required: overrides.is_required ?? false,
    is_visible_in_form: overrides.is_visible_in_form ?? true,
    is_visible_in_table: overrides.is_visible_in_table ?? true,
    sort_order: overrides.sort_order ?? 0,
    options: overrides.options,
    validation_rules: overrides.validation_rules,
    allow_multiple: overrides.allow_multiple,
    created_at: overrides.created_at ?? "2024-01-01T00:00:00.000Z",
    updated_at: overrides.updated_at ?? "2024-01-01T00:00:00.000Z",
  };
}

describe("createDynamicLeadSchema", () => {
  it("enforces required fields and transforms checkbox inputs", () => {
    const schema = createDynamicLeadSchema([
      buildDefinition({
        field_key: "name",
        label: "Name",
        field_type: "text",
        is_required: true,
      }),
      buildDefinition({
        field_key: "opt_in",
        label: "Opt In",
        field_type: "checkbox",
      }),
    ]);

    const success = schema.safeParse({
      field_name: "Tayte",
      field_opt_in: "true",
    });

    expect(success.success).toBe(true);
    if (success.success) {
      expect(success.data.field_opt_in).toBe(true);
    }

    const missingRequired = schema.safeParse({
      field_name: "",
      field_opt_in: false,
    });

    expect(missingRequired.success).toBe(false);
    if (!missingRequired.success) {
      expect(missingRequired.error.issues[0]?.message).toBe("Name is required");
    }
  });

  it("treats optional fields as nullable/undefined", () => {
    const schema = createDynamicLeadSchema([
      buildDefinition({
        field_key: "name",
        label: "Name",
        field_type: "text",
        is_required: true,
      }),
      buildDefinition({
        field_key: "budget",
        label: "Budget",
        field_type: "number",
        validation_rules: { min: 10, max: 100 },
      }),
    ]);

    const optional = schema.safeParse({
      field_name: "Valid",
      field_opt_in: false,
    });

    expect(optional.success).toBe(true);

    const belowMinimum = schema.safeParse({
      field_name: "Valid",
      field_budget: "5",
    });

    expect(belowMinimum.success).toBe(false);
    if (!belowMinimum.success) {
      expect(belowMinimum.error.issues[0]?.message).toBe(
        "Number must be at least 10"
      );
    }
  });

  it("accepts numeric inputs for number fields without string casting", () => {
    const schema = createDynamicLeadSchema([
      buildDefinition({
        field_key: "tax_id",
        label: "Tax ID",
        field_type: "number",
        is_required: true,
      }),
    ]);

    const withNumber = schema.safeParse({
      field_tax_id: 1234567890,
    });
    expect(withNumber.success).toBe(true);

    const withString = schema.safeParse({
      field_tax_id: "987654321",
    });
    expect(withString.success).toBe(true);

    const invalid = schema.safeParse({
      field_tax_id: "not-a-number",
    });
    expect(invalid.success).toBe(false);
    if (!invalid.success) {
      expect(invalid.error.issues[0]?.message).toBe("Please enter a valid number");
    }
  });
});

describe("sanitizeFieldValue", () => {
  const sanitize = (
    value: unknown,
    fieldType: LeadFieldType
  ): string | null => sanitizeFieldValue(value, fieldType);

  it("normalizes checkbox values to boolean strings", () => {
    expect(sanitize(true, "checkbox")).toBe("true");
    expect(sanitize("0", "checkbox")).toBe("true");
  });

  it("returns null for empty values", () => {
    expect(sanitize(null, "text")).toBeNull();
    expect(sanitize("", "number")).toBeNull();
  });

  it("coerces numeric values into trimmed strings when valid", () => {
    expect(sanitize(" 42 ", "number")).toBe("42");
    expect(sanitize("abc", "number")).toBeNull();
  });

  it("trims string-based inputs", () => {
    expect(sanitize("  hello  ", "text")).toBe("hello");
  });

  it("returns ISO date segments for date inputs", () => {
    expect(sanitize("2024-05-01T15:30:00Z", "date")).toBe("2024-05-01");
  });
});

describe("parseFieldValue", () => {
  it("converts checkbox strings to booleans", () => {
    expect(parseFieldValue("true", "checkbox")).toBe(true);
    expect(parseFieldValue("1", "checkbox")).toBe(true);
    expect(parseFieldValue(null, "checkbox")).toBe(false);
  });

  it("returns numbers when parsing numeric values", () => {
    expect(parseFieldValue("42", "number")).toBe(42);
    expect(parseFieldValue("3.14", "number")).toBe(3.14);
    expect(parseFieldValue("abc", "number")).toBe("");
  });

  it("defaults to empty strings for nullish non-checkbox values", () => {
    expect(parseFieldValue(null, "text")).toBe("");
    expect(parseFieldValue(undefined, "email")).toBe("");
  });
});

describe("validateFieldValue", () => {
  it("returns success for valid optional values", () => {
    const definition = buildDefinition({
      field_key: "budget",
      label: "Budget",
      field_type: "number",
      validation_rules: { min: 10, max: 100 },
    });

    expect(validateFieldValue("42", definition)).toEqual({ isValid: true });
    expect(validateFieldValue("", definition)).toEqual({ isValid: true });
  });

  it("captures numeric rule violations with helpful messages", () => {
    const definition = buildDefinition({
      field_key: "budget",
      label: "Budget",
      field_type: "number",
      validation_rules: { min: 10, max: 100 },
    });

    expect(validateFieldValue("5", definition)).toEqual({
      isValid: false,
      error: "Number must be at least 10",
    });
  });

  it("validates required text inputs with min length rules", () => {
    const definition = buildDefinition({
      field_key: "name",
      label: "Name",
      field_type: "text",
      is_required: true,
      validation_rules: { minLength: 3 },
    });

    expect(validateFieldValue("Taylor", definition)).toEqual({ isValid: true });
    expect(validateFieldValue("hi", definition)).toEqual({
      isValid: false,
      error: "Text must be at least 3 characters",
    });
  });

  it("flags invalid email inputs", () => {
    const definition = buildDefinition({
      field_key: "email",
      label: "Email",
      field_type: "email",
    });

    expect(validateFieldValue("person@example.com", definition)).toEqual({
      isValid: true,
    });

    expect(validateFieldValue("not-an-email", definition)).toEqual({
      isValid: false,
      error: "Please enter a valid email address",
    });
  });
});
