import React, { type ChangeEvent, type ReactElement, type ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { render, fireEvent } from "@testing-library/react";
import {
  useProjectsListFilters,
  useProjectsArchivedFilters,
} from "../useProjectsFilters";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

jest.mock("@/components/ui/checkbox", () => ({
  Checkbox: ({ checked, onCheckedChange, ...props }: { checked?: boolean; onCheckedChange?: (checked: boolean) => void }) => (
    <input
      type="checkbox"
      checked={checked}
      onChange={(event) => onCheckedChange?.(event.target.checked)}
      {...props}
    />
  ),
}));

jest.mock("@/components/ui/accordion", () => ({
  Accordion: ({ children, ...props }: { children: ReactNode }) => <div {...props}>{children}</div>,
  AccordionItem: ({ children, ...props }: { children: ReactNode }) => <div {...props}>{children}</div>,
  AccordionTrigger: ({ children, ...props }: { children: ReactNode }) => <div {...props}>{children}</div>,
  AccordionContent: ({ children, ...props }: { children: ReactNode }) => <div {...props}>{children}</div>,
}));

jest.mock("@/components/ui/toggle-group", () => ({
  ToggleGroup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ToggleGroupItem: ({ children, value, onClick }: { children: ReactNode; value: string; onClick?: (value: string) => void }) => (
    <button type="button" onClick={() => onClick?.(value)} data-value={value}>
      {children}
    </button>
  ),
}));

jest.mock("@/components/ui/input", () => ({
  Input: ({ value, onChange, ...props }: { value?: string; onChange?: (event: ChangeEvent<HTMLInputElement>) => void }) => (
    <input value={value ?? ""} onChange={(event) => onChange?.(event)} {...props} />
  ),
}));

const typeOptions = [{ id: "wedding", name: "Wedding" }];
const stageOptions = [{ id: "planning", name: "Planning" }];
const serviceOptions = [{ id: "photo", name: "Photography" }];

describe("useProjectsListFilters", () => {
  it("toggles type filter and updates summary chips", () => {
    const onStateChange = jest.fn();
    const { result } = renderHook(() =>
      useProjectsListFilters({
        typeOptions,
        stageOptions,
        serviceOptions,
        onStateChange,
      })
    );

    expect(result.current.activeCount).toBe(0);

    const { getByLabelText } = render(result.current.filtersConfig.content as ReactElement);

    act(() => {
      fireEvent.click(getByLabelText("Wedding"));
    });

    expect(result.current.state.types).toEqual(["wedding"]);
    expect(result.current.activeCount).toBe(1);
    expect(result.current.summaryChips).toHaveLength(1);
    expect(onStateChange).toHaveBeenCalled();
  });
});

describe("useProjectsArchivedFilters", () => {
  it("applies balance inputs and resets", () => {
    const { result } = renderHook(() =>
      useProjectsArchivedFilters({
        typeOptions,
      })
    );

    const { getByPlaceholderText, getByText } = render(result.current.filtersConfig.content as ReactElement);

    act(() => {
      fireEvent.change(getByPlaceholderText("projects.filters.balanceMinPlaceholder"), {
        target: { value: "100" },
      });
      fireEvent.change(getByPlaceholderText("projects.filters.balanceMaxPlaceholder"), {
        target: { value: "500" },
      });
    });

    expect(result.current.state.balanceMin).toBe(100);
    expect(result.current.state.balanceMax).toBe(500);
    expect(result.current.activeCount).toBe(2);

    act(() => {
      result.current.reset();
    });

    expect(result.current.state.balanceMin).toBeNull();
    expect(result.current.activeCount).toBe(0);
    expect(result.current.summaryChips).toHaveLength(0);
  });
});
