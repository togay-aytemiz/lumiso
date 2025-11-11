import { CheckCircle, PenSquare, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useFormsTranslation } from '@/hooks/useTypedTranslation';
import { IconActionButton } from "@/components/ui/icon-action-button";
import { IconActionButtonGroup } from "@/components/ui/icon-action-button-group";
interface ActivityTimelineItemProps {
  id: string;
  type: 'note' | 'reminder';
  content: string;
  completed?: boolean;
  projectName?: string;
  onToggleCompletion?: (id: string, completed: boolean) => void;
  onEditNote?: () => void;
  onDeleteNote?: () => void;
}
export function ActivityTimelineItem({
  id,
  type,
  content,
  completed = false,
  projectName,
  onToggleCompletion,
  onEditNote,
  onDeleteNote
}: ActivityTimelineItemProps) {
  const { t } = useFormsTranslation();

  // Map type to translation key safely
  const typeLabel = type === 'note'
    ? t('activities.types.note') 
    : t('activities.types.reminder');
  
  return <div className="flex gap-3 py-2">
      {/* Timeline dot */}
      
      
      {/* Content */}
      <div className="flex-1 min-w-0 pb-2">
        <div className="flex items-start gap-2 mb-1">
          <Badge variant="outline" className="text-xs h-5">
            {typeLabel}
          </Badge>
          {projectName && <Badge variant="secondary" className="text-xs h-5">
              {projectName}
            </Badge>}
        </div>
        
        <div className="flex items-start justify-between gap-3">
          <p className={`text-sm leading-relaxed break-words ${completed ? 'line-through opacity-60' : ''}`}>
            {content}
          </p>

          {type === 'reminder' && onToggleCompletion && <button onClick={() => onToggleCompletion(id, !completed)} className="flex items-center justify-center w-5 h-5 rounded-full border-2 border-muted-foreground/40 hover:border-primary transition-colors flex-shrink-0 mt-0.5">
              {completed ? <CheckCircle className="h-3 w-3 text-green-600 dark:text-green-400" /> : <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />}
            </button>}

          {type === 'note' && (onEditNote || onDeleteNote) && (
            <IconActionButtonGroup>
              {onEditNote && (
                <IconActionButton
                  onClick={onEditNote}
                  aria-label={t('activities.edit_note')}
                >
                  <PenSquare className="h-4 w-4" />
                </IconActionButton>
              )}
              {onDeleteNote && (
                <IconActionButton
                  onClick={onDeleteNote}
                  variant="danger"
                  aria-label={t('activities.delete_note_title')}
                >
                  <Trash2 className="h-4 w-4" />
                </IconActionButton>
              )}
            </IconActionButtonGroup>
          )}
        </div>
      </div>
    </div>;
}