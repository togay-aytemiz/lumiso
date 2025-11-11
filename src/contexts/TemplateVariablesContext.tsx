import { createContext, useContext } from "react";
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

export const TemplateVariablesProvider = TemplateVariablesContext.Provider;

export function useTemplateVariablesContext() {
  return useContext(TemplateVariablesContext);
}

export { TemplateVariablesContext };
