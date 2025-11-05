import type {
  ReactNode,
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ChangeEvent,
} from "react";
import { act, renderHook, render, fireEvent } from "@testing-library/react";
import { useLeadsFilters } from "../useLeadsFilters";
import type { LeadFieldDefinition } from "@/types/leadFields";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string, options?: Record<string, unknown>) =>
    typeof options?.count !== "undefined" ? `${key}:${options.count}` : key,
  }),
}));

jest.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));

jest.mock("@/components/ui/checkbox", () => ({
  Checkbox: ({ checked, onCheckedChange, ...props }: { checked?: boolean; onCheckedChange?: (next: boolean) => void }) => (
    <input
      type="checkbox"
      checked={checked}
      onChange={(event) => onCheckedChange?.(event.target.checked)}
      {...props}
    />
  ),
}));

jest.mock("@/components/ui/accordion", () => ({
  Accordion: ({ children, ...props }: { children?: ReactNode }) => <div {...props}>{children}</div>,
  AccordionItem: ({ children, ...props }: { children?: ReactNode }) => <div {...props}>{children}</div>,
  AccordionTrigger: ({ children, ...props }: { children?: ReactNode }) => <div {...props}>{children}</div>,
  AccordionContent: ({ children, ...props }: { children?: ReactNode }) => <div {...props}>{children}</div>,
}));

jest.mock("@/components/ui/select", () => ({
  Select: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children, value, onSelect }: { children?: ReactNode; value: string; onSelect?: (value: string) => void }) => (
    <div onClick={() => onSelect?.(value)}>{children}</div>
  ),
  SelectTrigger: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  SelectValue: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
}));

jest.mock("@/components/ui/input", () => ({
  Input: ({ value, onChange, ...props }: InputHTMLAttributes<HTMLInputElement>) => (
    <input
      value={value ?? ""}
      onChange={(event: ChangeEvent<HTMLInputElement>) => onChange?.(event)}
      {...props}
    />
  ),
}));

jest.mock("@/components/ui/segmented-control", () => ({
  SegmentedControl: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

jest.mock("@/components/ui/radio-group", () => ({
  RadioGroup: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  RadioGroupItem: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
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

interface LeadStatusOptionMock {
  id: string;
  name: string;
  color: string;
  is_system_final?: boolean;
}

const statuses: LeadStatusOptionMock[] = [{ id: "status-1", name: "Open", color: "blue" }];

const renderConfigNode = (node: ReactNode) => render(<>{node}</>);

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

    const { getByLabelText } = renderConfigNode(result.current.filtersConfig.content);

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

    const statusRender = renderConfigNode(result.current.filtersConfig.content);

    act(() => {
      fireEvent.click(statusRender.getByLabelText("Open"));
    });

    expect(result.current.state.status).toEqual(["Open"]);
    statusRender.unmount();

    const footerRender = renderConfigNode(result.current.filtersConfig.footer);

    act(() => {
      fireEvent.click(footerRender.getByRole("button", { name: "buttons.clearAll" }));
    });

    expect(result.current.state.status).toEqual([]);
    expect(result.current.activeCount).toBe(0);
    expect(result.current.isDirty).toBe(false);
  });
});
