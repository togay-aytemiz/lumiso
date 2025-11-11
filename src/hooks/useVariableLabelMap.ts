import { useMemo } from "react";
import { useTemplateVariablesContext } from "@/contexts/TemplateVariablesContext";

export function useVariableLabelMap() {
  const { variables } = useTemplateVariablesContext();

  return useMemo(() => {
    const map: Record<string, string> = {};
    for (const variable of variables) {
      map[variable.key] = variable.label;
    }
    return map;
  }, [variables]);
}
