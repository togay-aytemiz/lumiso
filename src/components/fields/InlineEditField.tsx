import { useState, useRef, useEffect, ReactNode } from 'react';
import { Edit2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InlineEditFieldProps {
  value: string | null;
  isEditing: boolean;
  onStartEdit: () => void;
  onSave: (value: string) => Promise<void>;
  onCancel: () => void;
  children: ReactNode;
  editComponent: ReactNode;
  className?: string;
  disabled?: boolean;
}

export function InlineEditField({
  value,
  isEditing,
  onStartEdit,
  onSave,
  onCancel,
  children,
  editComponent,
  className,
  disabled = false
}: InlineEditFieldProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle click outside to cancel edit
  useEffect(() => {
    if (!isEditing) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onCancel();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isEditing, onCancel]);

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!isEditing) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCancel();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isEditing, onCancel]);

  const handleSave = async (newValue: string) => {
    if (isSaving) return;
    
    setIsSaving(true);
    try {
      await onSave(newValue);
    } finally {
      setIsSaving(false);
    }
  };

  if (disabled) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative group",
        isEditing && "z-10",
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {isEditing ? (
        <div className="w-full">
          {editComponent}
        </div>
      ) : (
        <>
          <div className="w-full">{children}</div>
          {isHovered && !isSaving && (
            <button
              onClick={onStartEdit}
              className="absolute top-0 -right-1 p-1 bg-background border border-border rounded-md shadow-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-20"
              title="Click to edit"
            >
              <Edit2 className="h-3 w-3 text-muted-foreground" />
            </button>
          )}
        </>
      )}
    </div>
  );
}