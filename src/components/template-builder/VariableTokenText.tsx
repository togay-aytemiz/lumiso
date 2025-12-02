import { useMemo } from "react";

const VARIABLE_REGEX =
  /\{\{\s*([a-zA-Z0-9_]+)\s*(?:\|([^}]*))?\s*\}\}|\{\s*([a-zA-Z0-9_]+)\s*(?:\|([^}]*))?\s*\}/g;

interface VariableTokenTextProps {
  text: string;
  placeholder?: string;
  variableLabels: Record<string, string>;
}

interface Token {
  type: "text" | "variable";
  value: string;
  key?: string;
  raw?: string;
}

function tokenize(text: string, variableLabels: Record<string, string>): Token[] {
  const tokens: Token[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = VARIABLE_REGEX.exec(text)) !== null) {
    const matchIndex = match.index;
    const matchLength = match[0].length;
    if (matchIndex > lastIndex) {
      tokens.push({
        type: "text",
        value: text.slice(lastIndex, matchIndex),
      });
    }

    const key = match[1] ?? match[3];
    const fallbackLabel = match[2] ?? match[4];
    const label = variableLabels[key] || fallbackLabel || key;

    tokens.push({
      type: "variable",
      value: label,
      key,
      raw: match[0],
    });

    lastIndex = matchIndex + matchLength;
  }

  if (lastIndex < text.length) {
    tokens.push({
      type: "text",
      value: text.slice(lastIndex),
    });
  }

  return tokens;
}

export function VariableTokenText({ text, placeholder, variableLabels }: VariableTokenTextProps) {
  const tokens = useMemo(() => tokenize(text, variableLabels), [text, variableLabels]);
  const placeholderText = placeholder ?? "";

  if (!text) {
    return (
      <span className="text-muted-foreground">
        {placeholderText}
      </span>
    );
  }

  return (
    <>
      {tokens.map((token, index) => {
        if (token.type === "text") {
          return (
            <span key={`text-${index}`}>
              {token.value}
            </span>
          );
        }

        const rawWidthText = token.key ? `{${token.key}}` : token.raw ?? token.value;

        return (
          <span
            key={`variable-${index}-${token.key}`}
            className="relative inline-block align-baseline"
          >
            <span className="invisible whitespace-pre text-sm font-normal">
              {rawWidthText}
            </span>
            <span className="absolute left-0 top-0 inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground align-middle box-border pointer-events-none">
              {token.value}
            </span>
          </span>
        );
      })}
    </>
  );
}
