import { MouseEvent, ReactNode, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import {
  ProjectCreationWizardSheet,
  ProjectCreationStepId,
} from "@/features/project-creation";
import { useTranslation } from "react-i18next";

interface EnhancedProjectDialogProps {
  defaultLeadId?: string;
  leadName?: string;
  onProjectCreated?: (project?: { id: string; name?: string }) => void;
  children?: ReactNode;
  defaultStatusId?: string | null;
  triggerDisabled?: boolean;
  entrySource?: string;
  startStepOverride?: ProjectCreationStepId;
}

/**
 * @deprecated Legacy compat wrapper around ProjectCreationWizardSheet.
 *             Prefer importing the sheet directly for new entry points.
 */
export function LegacyEnhancedProjectDialog({
  defaultLeadId,
  leadName,
  onProjectCreated,
  children,
  defaultStatusId,
  triggerDisabled = false,
  entrySource,
  startStepOverride,
}: EnhancedProjectDialogProps) {
  const { t: tForms } = useTranslation("forms");
  const [open, setOpen] = useState(false);

  const resolvedEntrySource = useMemo(
    () => entrySource ?? "projects",
    [entrySource]
  );

  const handleTriggerClick = (event: MouseEvent<HTMLDivElement>) => {
    if (triggerDisabled) {
      event.preventDefault();
      return;
    }
    setOpen(true);
  };

  const trigger = children ? (
    <div
      onClick={handleTriggerClick}
      className={triggerDisabled ? "opacity-60" : undefined}
    >
      {children}
    </div>
  ) : (
    <Button
      onClick={() => setOpen(true)}
      disabled={triggerDisabled}
      size="sm"
      className="h-10"
    >
      <Plus className="mr-2 h-4 w-4" />
      {tForms("projectDialog.addProject")}
    </Button>
  );

  return (
    <>
      {trigger}
      <ProjectCreationWizardSheet
        isOpen={open}
        onOpenChange={setOpen}
        leadId={defaultLeadId}
        leadName={leadName}
        defaultStatusId={defaultStatusId}
        entrySource={resolvedEntrySource}
        startStepOverride={startStepOverride}
        onProjectCreated={onProjectCreated}
      />
    </>
  );
}

export { LegacyEnhancedProjectDialog as EnhancedProjectDialog };
