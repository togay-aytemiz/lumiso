import { act, renderHook } from "@testing-library/react";
import { render, fireEvent } from "@testing-library/react";
import { useLeadsFilters } from "../useLeadsFilters";
import type { LeadFieldDefinition } from "@/types/leadFields";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string, options?: Record<string, unknown>) =>
    typeof options?.count !== "undefined" ? `${key}:${options.count}` : key,
  }),
}));

jest.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

jest.mock("@/components/ui/checkbox", () => ({
  Checkbox: ({ checked, onCheckedChange, ...props }: any) => (
    <input
      type="checkbox"
      checked={checked}
      onChange={(event) => onCheckedChange?.(event.target.checked)}
      {...props}
    />
  ),
}));

jest.mock("@/components/ui/accordion", () => ({
  Accordion: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  AccordionItem: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  AccordionTrigger: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  AccordionContent: ({ children, ...props }: any) => <div {...props}>{children}</div>,
}));

jest.mock("@/components/ui/select", () => ({
  Select: ({ children }: any) => <div>{children}</div>,
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ children, value, onSelect }: any) => (
    <div onClick={() => onSelect?.(value)}>{children}</div>
  ),
  SelectTrigger: ({ children }: any) => <div>{children}</div>,
  SelectValue: ({ children }: any) => <span>{children}</span>,
}));

jest.mock("@/components/ui/input", () => ({
  Input: ({ value, onChange, ...props }: any) => (
    <input value={value ?? ""} onChange={(event) => onChange?.(event)} {...props} />
  ),
}));

jest.mock("@/components/ui/segmented-control", () => ({
  SegmentedControl: ({ children }: any) => <div>{children}</div>,
}));

jest.mock("@/components/ui/radio-group", () => ({
  RadioGroup: ({ children }: any) => <div>{children}</div>,
  RadioGroupItem: ({ children }: any) => <div>{children}</div>,
}));

const nowIso = new Date().toISOString();

const fieldDefinitions: LeadFieldDefinition[] = [
  {
    id: "field-1",
    organization_id: "org-1",
    field_key: "notes_extra",
    label: "Notes Extra",
    field_type: "text",
    is_system: false,
    is_required: false,
    is_visible_in_form: true,
    is_visible_in_table: true,
    sort_order: 1,
    allow_multiple: false,
    created_at: nowIso,
    updated_at: nowIso,
  },
];

const statuses = [{ id: "status-1", name: "Open", color: "blue" }];

describe("useLeadsFilters", () => {
  it("auto applies status selections and updates active count", () => {
    const { result } = renderHook(() =>
      useLeadsFilters({
        statuses,
        fieldDefinitions,
      })
    );

    expect(result.current.state.status).toEqual([]);
    expect(result.current.activeCount).toBe(0);

    const { getByLabelText } = render(result.current.filtersConfig.content as any);

    act(() => {
      fireEvent.click(getByLabelText("Open"));
    });

    expect(result.current.state.status).toEqual(["Open"]);
    expect(result.current.activeCount).toBe(1);
    expect(result.current.isDirty).toBe(true);
  });

  it("clears filters via footer action", () => {
    const { result } = renderHook(() =>
      useLeadsFilters({
        statuses,
        fieldDefinitions,
      })
    );

    const statusRender = render(result.current.filtersConfig.content as any);

    act(() => {
      fireEvent.click(statusRender.getByLabelText("Open"));
    });

    expect(result.current.state.status).toEqual(["Open"]);
    statusRender.unmount();

    const footerRender = render(result.current.filtersConfig.footer as any);

    act(() => {
      fireEvent.click(footerRender.getByRole("button", { name: "buttons.clearAll" }));
    });

    expect(result.current.state.status).toEqual([]);
    expect(result.current.activeCount).toBe(0);
    expect(result.current.isDirty).toBe(false);
  });
});
