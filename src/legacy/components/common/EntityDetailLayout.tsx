import React from 'react';
import { ArrowLeft, Pencil, Save, X, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface EntityDetailLayoutProps {
  title: string;
  description?: string;
  badges?: Array<{
    label: string;
    variant?: 'default' | 'secondary' | 'destructive' | 'outline';
    className?: string;
  }>;
  onBack?: () => void;
  onEdit?: () => void;
  onSave?: () => void;
  onCancel?: () => void;
  isEditing?: boolean;
  isSaving?: boolean;
  canEdit?: boolean;
  editForm?: React.ReactNode;
  actions?: Array<{
    label: string;
    onClick: () => void;
    variant?: 'default' | 'destructive' | 'outline' | 'secondary';
    icon?: React.ReactNode;
  }>;
  children: React.ReactNode;
}

export function EntityDetailLayout({
  title,
  description,
  badges,
  onBack,
  onEdit,
  onSave,
  onCancel,
  isEditing = false,
  isSaving = false,
  canEdit = true,
  editForm,
  actions = [],
  children
}: EntityDetailLayoutProps) {
  return (
    <div className="w-full min-h-screen p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0 space-y-4">
            {isEditing && editForm ? (
              editForm
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3 flex-wrap">
                  {onBack && (
                    <ArrowLeft 
                      className="h-6 w-6 cursor-pointer text-foreground hover:text-[hsl(var(--accent-foreground))] transition-colors" 
                      strokeWidth={2.5}
                      onClick={onBack}
                    />
                  )}
                  <h1 className="text-xl sm:text-2xl font-bold leading-tight break-words">
                    {title}
                  </h1>
                  
                  {/* Badges */}
                  {badges && badges.length > 0 && (
                    <div className="flex items-center gap-3 flex-wrap">
                      {badges.map((badge, index) => (
                        <Badge 
                          key={index}
                          variant={badge.variant || 'outline'} 
                          className={cn("text-sm px-3 py-1", badge.className)}
                        >
                          {badge.label}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                
                {/* Description */}
                {description && (
                  <p className="text-muted-foreground text-lg">
                    {description}
                  </p>
                )}
              </div>
            )}
          </div>
          
          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0 self-start">
            {!isEditing && canEdit && onEdit && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={onEdit}
                className="flex items-center gap-2"
              >
                <Pencil className="h-4 w-4" />
                <span className="hidden sm:inline">Edit</span>
              </Button>
            )}
            
            {isEditing && (
              <div className="flex gap-2">
                <Button 
                  onClick={onSave}
                  disabled={isSaving}
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <Save className="h-4 w-4" />
                  {isSaving ? "Saving..." : "Save"}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={onCancel}
                  disabled={isSaving}
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <X className="h-4 w-4" />
                  Cancel
                </Button>
              </div>
            )}

            {actions.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {actions.map((action, index) => (
                    <DropdownMenuItem 
                      key={index}
                      onClick={action.onClick}
                      className="flex items-center gap-2"
                    >
                      {action.icon}
                      {action.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      {children}
    </div>
  );
}
