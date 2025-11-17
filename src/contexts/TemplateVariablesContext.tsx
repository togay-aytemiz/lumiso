/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, type ReactNode } from "react";
import type { TemplateVariable } from "@/types/templateBuilder";

interface TemplateVariablesValue {
  variables: TemplateVariable[];
  businessInfo: Record<string, unknown> | null;
  loading: boolean;
  getVariableValue: (key: string, mockData?: Record<string, string>) => string;
  refetch: () => Promise<void> | void;
}

const defaultValue: TemplateVariablesValue = {
  variables: [],
  businessInfo: null,
  loading: false,
  getVariableValue: (key: string) => `{${key}}`,
  refetch: async () => {},
};

const TemplateVariablesContext = createContext<TemplateVariablesValue>(defaultValue);

interface TemplateVariablesProviderProps {
  value?: TemplateVariablesValue;
  children: ReactNode;
}

export function TemplateVariablesProvider({
  value = defaultValue,
  children,
}: TemplateVariablesProviderProps) {
  return (
    <TemplateVariablesContext.Provider value={value}>
      {children}
    </TemplateVariablesContext.Provider>
  );
}

export function useTemplateVariablesContext() {
  return useContext(TemplateVariablesContext);
}
