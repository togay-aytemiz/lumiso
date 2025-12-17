import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Edit, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContentDark,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface TemplateBuilderHeaderProps {
  name: string;
  onNameChange: (name: string) => void;
  statusLabel?: string;
  statusBadge?: React.ReactNode;
  isDraft: boolean;
  draftLabel: string;
  publishedLabel: string;
  backLabel: string;
  publishLabel: string;
  doneLabel: string;
  onBack: () => void;
  onPrimaryAction: () => void;
  primaryDisabled?: boolean;
  publishTooltip?: string;
  primaryClassName?: string;
  primaryLeftActions?: React.ReactNode;
  rightActions?: React.ReactNode;
  disableNameEditing?: boolean;
  eyebrow?: React.ReactNode;
  subtitle?: React.ReactNode;
  children?: React.ReactNode;
}

/**
 * Shared header for the template builder screens with inline title editing.
 */
export function TemplateBuilderHeader({
  name,
  onNameChange,
  statusLabel,
  statusBadge,
  isDraft,
  draftLabel,
  publishedLabel,
  backLabel,
  publishLabel,
  doneLabel,
  onBack,
  onPrimaryAction,
  primaryDisabled,
  publishTooltip,
  primaryClassName,
  primaryLeftActions,
  rightActions,
  disableNameEditing = false,
  eyebrow,
  subtitle,
  children,
}: TemplateBuilderHeaderProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [localName, setLocalName] = useState(name);
  const [publishTooltipOpen, setPublishTooltipOpen] = useState(false);

  useEffect(() => {
    if (!isEditingName) {
      setLocalName(name);
    }
  }, [name, isEditingName]);

  useEffect(() => {
    if (disableNameEditing && isEditingName) {
      setIsEditingName(false);
      setLocalName(name);
    }
  }, [disableNameEditing, isEditingName, name]);

  const badgeLabel = useMemo(() => (isDraft ? draftLabel : publishedLabel), [draftLabel, isDraft, publishedLabel]);
  const resolvedPrimaryClassName = useMemo(() => primaryClassName ?? "btn-surface-accent", [primaryClassName]);

  const commitNameChange = useCallback(() => {
    setIsEditingName(false);
    if (disableNameEditing) {
      setLocalName(name);
      return;
    }
    if (localName !== name) {
      onNameChange(localName);
    }
  }, [disableNameEditing, localName, name, onNameChange]);

  const handleNameKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter") {
      commitNameChange();
    }
    if (event.key === "Escape") {
      setIsEditingName(false);
      setLocalName(name);
    }
  };

  return (
    <div className="border-b bg-background px-6 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Button
            type="button"
            variant="tinted"
            colorScheme="slate"
            size="icon"
            onClick={onBack}
            className="h-10 w-10"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={2.5} />
            <span className="sr-only">{backLabel}</span>
          </Button>
          <div className="flex min-w-0 flex-col gap-1">
            {eyebrow ? (
              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                {eyebrow}
              </div>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              {isEditingName ? (
                <Input
                  value={localName}
                  onChange={(event) => setLocalName(event.target.value)}
                  onBlur={commitNameChange}
                  onKeyDown={handleNameKeyDown}
                  className="h-auto w-[min(480px,100%)] min-w-[200px] border bg-background px-2 py-1 text-lg font-semibold focus-visible:ring-1"
                  autoFocus
                />
              ) : (
                <>
                  <span className="font-semibold text-lg">{name}</span>
                  {!disableNameEditing ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsEditingName(true)}
                      className="h-6 w-6 p-0"
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                  ) : null}
                  {statusBadge ? (
                    statusBadge
                  ) : (
                    <Badge variant={isDraft ? "secondary" : "default"}>
                      {badgeLabel}
                    </Badge>
                  )}
                  {statusLabel ? <span className="text-xs text-muted-foreground">{statusLabel}</span> : null}
                </>
              )}
            </div>
            {subtitle ? (
              <div className="flex items-center gap-2 text-sm text-foreground">
                {subtitle}
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {primaryLeftActions}
          {primaryDisabled ? (
            <TooltipProvider delayDuration={0}>
              <Tooltip
                open={publishTooltipOpen}
                onOpenChange={setPublishTooltipOpen}
                disableHoverableContent
              >
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      onClick={onPrimaryAction}
                      disabled
                      variant="surface"
                      size="sm"
                      className={resolvedPrimaryClassName}
                    >
                      <Eye className="h-4 w-4" />
                      {isDraft ? publishLabel : doneLabel}
                    </Button>
                  </span>
                </TooltipTrigger>
                {publishTooltip ? (
                  <TooltipContentDark side="bottom" align="center">
                    <span className="max-w-[240px] text-sm text-slate-50">
                      {publishTooltip}
                    </span>
                  </TooltipContentDark>
                ) : null}
              </Tooltip>
            </TooltipProvider>
          ) : (
            <Button
              onClick={onPrimaryAction}
              disabled={primaryDisabled}
              variant="surface"
              size="sm"
              className={resolvedPrimaryClassName}
            >
              <Eye className="h-4 w-4" />
              {isDraft ? publishLabel : doneLabel}
            </Button>
          )}
          {rightActions}
        </div>
      </div>

      {children ? (
        <div className="mt-3 pt-3 border-t space-y-3">
          {children}
        </div>
      ) : null}
    </div>
  );
}
