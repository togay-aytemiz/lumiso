import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CheckSquare, Trash2, Plus, Edit, Check, X } from "lucide-react";
import { ProgressBar } from "@/components/ui/progress-bar";
import { EmptyState } from "@/components/EmptyState";
import { EmptyStateInfoSheet } from "@/components/empty-states/EmptyStateInfoSheet";
import { useFormsTranslation, useCommonTranslation } from '@/hooks/useTypedTranslation';
import { logAuditEvent } from "@/lib/auditLog";
import type { Json } from "@/integrations/supabase/types";

interface Todo {
  id: string;
  content: string;
  is_completed: boolean;
  created_at: string;
}

interface ProjectTodoListEnhancedProps {
  projectId: string;
  onTodosUpdated?: () => void;
}

export function ProjectTodoListEnhanced({
  projectId,
  onTodosUpdated
}: ProjectTodoListEnhancedProps) {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTodoContent, setNewTodoContent] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [showTodoInfo, setShowTodoInfo] = useState(false);
  const addInputRef = useRef<HTMLInputElement>(null);
  const {
    toast
  } = useToast();
  const { t: tForms } = useFormsTranslation();
  const { t: tCommon } = useCommonTranslation();

  const getErrorMessage = useCallback((error: unknown) => {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === "string") {
      return error;
    }
    return "An unexpected error occurred";
  }, []);

  const fetchTodos = useCallback(async () => {
    setLoading(true);
    try {
      const {
        data,
        error
      } = await supabase.from('todos').select('*').eq('project_id', projectId).order('created_at', {
        ascending: false
      });
      if (error) throw error;
      setTodos(data || []);
    } catch (error: unknown) {
      console.error('Error fetching todos:', error);
      toast({
        title: tForms('todos.error_loading'),
        description: getErrorMessage(error),
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [projectId, toast, tForms, getErrorMessage]);

  useEffect(() => {
    void fetchTodos();
  }, [fetchTodos]);
  const handleToggleComplete = async (todoId: string, isCompleted: boolean) => {
    try {
      const existing = todos.find(todo => todo.id === todoId);
      const { error } = await supabase.from('todos').update({
        is_completed: !isCompleted
      }).eq('id', todoId);
      if (error) throw error;
      setTodos(todos.map(todo => todo.id === todoId ? {
        ...todo,
        is_completed: !isCompleted
      } : todo));
      if (existing) {
        void logAuditEvent({
          entityType: "todo",
          entityId: existing.id,
          action: "updated",
          oldValues: existing as unknown as Json,
          newValues: { ...existing, is_completed: !isCompleted } as unknown as Json
        });
      }
      onTodosUpdated?.();
      toast({
        title: tCommon('success'),
        description: `${tForms('todos.todo')} ${!isCompleted ? tForms('todos.completed') : tForms('todos.reopened')}.`
      });
    } catch (error: unknown) {
      toast({
        title: tForms('todos.error_updating'),
        description: getErrorMessage(error),
        variant: "destructive"
      });
    }
  };
  const handleAddTodo = async () => {
    if (!newTodoContent.trim()) return;
    setIsAdding(true);
    try {
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      const {
        data,
        error
      } = await supabase.from('todos').insert({
        user_id: user.id,
        project_id: projectId,
        content: newTodoContent.trim()
      }).select('*').single();
      if (error) throw error;
      setTodos([data, ...todos]);
      setNewTodoContent("");
      void logAuditEvent({
        entityType: "todo",
        entityId: data.id,
        action: "created",
        newValues: data as unknown as Json
      });
      onTodosUpdated?.();
      toast({
        title: tCommon('success'),
        description: tForms('todos.todo_added')
      });
    } catch (error: unknown) {
      toast({
        title: tForms('todos.error_adding'),
        description: getErrorMessage(error),
        variant: "destructive"
      });
    } finally {
      setIsAdding(false);
    }
  };
  const handleEditTodo = async (todoId: string, newContent: string) => {
    if (!newContent.trim()) return;
    try {
      const existing = todos.find(todo => todo.id === todoId);
      const {
        error
      } = await supabase.from('todos').update({
        content: newContent.trim()
      }).eq('id', todoId);
      if (error) throw error;
      setTodos(todos.map(todo => todo.id === todoId ? {
        ...todo,
        content: newContent.trim()
      } : todo));
      setEditingId(null);
      setEditContent("");
      if (existing) {
        void logAuditEvent({
          entityType: "todo",
          entityId: existing.id,
          action: "updated",
          oldValues: existing as unknown as Json,
          newValues: { ...existing, content: newContent.trim() } as unknown as Json
        });
      }
      onTodosUpdated?.();
      toast({
        title: tCommon('success'),
        description: tForms('todos.todo_updated')
      });
    } catch (error: unknown) {
      toast({
        title: tForms('todos.error_updating'),
        description: getErrorMessage(error),
        variant: "destructive"
      });
    }
  };
  const startEditing = (todo: Todo) => {
    setEditingId(todo.id);
    setEditContent(todo.content);
  };
  const cancelEditing = () => {
    setEditingId(null);
    setEditContent("");
  };
  const handleDeleteTodo = async (todoId: string) => {
    try {
      const existing = todos.find(todo => todo.id === todoId);
      const {
        error
      } = await supabase.from('todos').delete().eq('id', todoId);
      if (error) throw error;
      setTodos(todos.filter(todo => todo.id !== todoId));
      if (existing) {
        void logAuditEvent({
          entityType: "todo",
          entityId: existing.id,
          action: "deleted",
          oldValues: existing as unknown as Json
        });
      }
      onTodosUpdated?.();
      toast({
        title: tCommon('success'),
        description: tForms('todos.todo_deleted')
      });
    } catch (error: unknown) {
      toast({
        title: tForms('todos.error_deleting'),
        description: getErrorMessage(error),
        variant: "destructive"
      });
    }
  };
  if (loading) {
    return <Card>
      <CardHeader className="pb-3">
         <CardTitle className="flex items-center gap-2 text-lg font-medium">
           <CheckSquare className="h-4 w-4" />
           {tForms('todos.title')}
         </CardTitle>
      </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="w-full h-4 bg-muted animate-pulse rounded" />
            <div className="w-3/4 h-4 bg-muted animate-pulse rounded" />
            <div className="w-1/2 h-4 bg-muted animate-pulse rounded" />
          </div>
        </CardContent>
      </Card>;
  }
  const completedCount = todos.filter(todo => todo.is_completed).length;
  const totalCount = todos.length;
  const progressPercentage = totalCount > 0 ? Math.round(completedCount / totalCount * 100) : 0;
  const todoInfoSectionsRaw = tForms("todos.emptyState.sections", {
    returnObjects: true,
    defaultValue: []
  });
  const todoInfoSections = Array.isArray(todoInfoSectionsRaw)
    ? (todoInfoSectionsRaw as { title: string; description: string }[])
    : [];
  const handleFocusNewTodo = () => {
    addInputRef.current?.focus();
  };
  return <Card>
      <CardHeader className="pb-3">
         <CardTitle className="flex items-center gap-2 text-xl font-semibold">
           <CheckSquare className="h-4 w-4" />
           {tForms('todos.title')}
         </CardTitle>
        {todos.length > 0 && <div className="pt-2">
            <ProgressBar value={progressPercentage} total={totalCount} completed={completedCount} size="md" />
          </div>}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add Todo Input */}
        <div className="flex gap-2">
          <Input ref={addInputRef} placeholder={tForms('todos.add_placeholder')} value={newTodoContent} onChange={e => setNewTodoContent(e.target.value)} onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleAddTodo();
          }
        }} className="flex-1" />
          <Button onClick={handleAddTodo} disabled={!newTodoContent.trim() || isAdding} className="h-11 w-11 p-0" aria-label={tForms('todos.add_todo')}>
            <Plus className="h-5 w-5" />
          </Button>
        </div>

        {todos.length > 0 ? <>
            <div className="space-y-3">
              {todos.map(todo => <div key={todo.id} className="flex items-center gap-2 p-2 bg-muted/30 rounded-md border">
                  <Checkbox checked={todo.is_completed} onCheckedChange={() => handleToggleComplete(todo.id, todo.is_completed)} />
                  <div className="flex-1 min-w-0">
                    {editingId === todo.id ? <div className="flex items-center gap-2">
                        <Input value={editContent} onChange={e => setEditContent(e.target.value)} onKeyDown={e => {
                  if (e.key === 'Enter') {
                    handleEditTodo(todo.id, editContent);
                  } else if (e.key === 'Escape') {
                    cancelEditing();
                  }
                }} className="flex-1" autoFocus />
                        <Button variant="ghost" size="sm" onClick={() => handleEditTodo(todo.id, editContent)} className="h-8 w-8 p-0 text-green-600 hover:text-green-700">
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={cancelEditing} className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground">
                          <X className="h-4 w-4" />
                        </Button>
                      </div> : <p className={`text-sm ${todo.is_completed ? 'line-through text-muted-foreground' : ''}`}>
                        {todo.content}
                      </p>}
                  </div>
                  {editingId !== todo.id && <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => startEditing(todo)} className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteTodo(todo.id)} className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>}
                </div>)}
            </div>
          </> : <EmptyState
            icon={CheckSquare}
            title={tForms('todos.no_todos')}
            helperAction={
              <Button
                variant="link"
                size="sm"
                className="h-auto px-0 text-sm text-emerald-700 underline underline-offset-4 decoration-emerald-400 hover:text-emerald-900"
                onClick={() => setShowTodoInfo(true)}
              >
                {tForms('todos.emptyState.learnMore')}
              </Button>
            }
            action={
              <Button
                variant="outline"
                className="border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 hover:text-emerald-950"
                onClick={handleFocusNewTodo}
              >
                <Plus className="h-4 w-4 mr-2" />
                {tForms('todos.add_todo')}
              </Button>
            }
          />}
      </CardContent>
      <EmptyStateInfoSheet
        open={showTodoInfo}
        onOpenChange={setShowTodoInfo}
        title={tForms('todos.emptyState.sheetTitle')}
        description={tForms('todos.emptyState.sheetDescription')}
        sections={todoInfoSections}
      />
    </Card>;
}
