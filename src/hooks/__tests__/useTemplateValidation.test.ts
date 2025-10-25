import { renderHook } from "@testing-library/react";

import { useTemplateValidation } from "../useTemplateValidation";

const baseTemplate = {
  id: "tpl-1",
  name: "Welcome Email",
  master_content: "Hello {name}",
  master_subject: "Subject",
  placeholders: ["name"],
  is_active: false,
  channels: {
    email: {
      subject: "Email Subject",
      content: "Email content with {name}",
      html_content: "<p>Email content</p>",
    },
  },
};

describe("useTemplateValidation", () => {
  it("returns error when template missing", () => {
    const { result } = renderHook(() => useTemplateValidation(null));

    expect(result.current.isValid).toBe(false);
    expect(result.current.errors).toEqual(["Template is required"]);
  });

  it("flags missing name and content", () => {
    const template = {
      ...baseTemplate,
      name: "",
      master_content: "",
      placeholders: [],
    };

    const { result } = renderHook(() => useTemplateValidation(template));

    expect(result.current.isValid).toBe(false);
    expect(result.current.errors).toEqual(["Template name is required"]);
    expect(result.current.warnings).toContain("Template content is empty");
  });

  it("adds warnings for untitled names and unused placeholders", () => {
    const template = {
      ...baseTemplate,
      name: "Untitled Template",
      master_content: "",
      placeholders: ["unused"],
      channels: { email: { subject: "", content: "" } },
    };

    const { result } = renderHook(() => useTemplateValidation(template));

    expect(result.current.isValid).toBe(true);
    expect(result.current.warnings).toEqual([
      "Template content is empty",
      "Consider giving your template a more descriptive name",
      'Placeholder "{unused}" is defined but not used in content',
    ]);
  });

  it("validates published template requirements", () => {
    const template = {
      ...baseTemplate,
      is_active: true,
      master_content: "",
      master_subject: "",
      placeholders: [],
      channels: { email: { subject: "", content: "" } },
    };

    const { result } = renderHook(() => useTemplateValidation(template));

    expect(result.current.isValid).toBe(false);
    expect(result.current.errors).toContain("Published templates must have content");
    expect(result.current.warnings).toEqual([
      "Template content is empty",
      "Published email templates should have a subject line",
    ]);
  });
});
