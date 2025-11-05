import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Trash2, Plus, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useFormsTranslation } from '@/hooks/useTypedTranslation';

interface Todo {
  id: string;
  content: string;
  is_completed: boolean;
  created_at: string;
}

interface ProjectTodoListProps {
  projectId: string;
}

export const ProjectTodoList: React.FC<ProjectTodoListProps> = ({ projectId }) => {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddingTodo, setIsAddingTodo] = useState(false);
  const [newTodoContent, setNewTodoContent] = useState('');
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const { toast } = useToast();
  const { t } = useFormsTranslation();

  const fetchTodos = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('todos')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTodos(data || []);
    } catch (error) {
      console.error('Error fetching todos:', error);
      toast({
        title: "Error",
        description: t("todos.error_load"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [projectId, t, toast]);

  useEffect(() => {
    void fetchTodos();
  }, [fetchTodos]);

  const addTodo = async () => {
    if (!newTodoContent.trim()) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('todos')
        .insert({
          project_id: projectId,
          user_id: user.id,
          content: newTodoContent.trim(),
        })
        .select()
        .single();

      if (error) throw error;
      
      setTodos(prev => [data, ...prev]);
      setNewTodoContent('');
      setIsAddingTodo(false);
      
      toast({
        title: "Success",
        description: t("todos.todo_added"),
      });
    } catch (error) {
      console.error('Error adding todo:', error);
      toast({
        title: "Error",
        description: t("todos.error_add"),
        variant: "destructive",
      });
    }
  };

  const toggleTodo = async (id: string, isCompleted: boolean) => {
    try {
      const { error } = await supabase
        .from('todos')
        .update({ is_completed: !isCompleted })
        .eq('id', id);

      if (error) throw error;
      
      setTodos(prev => prev.map(todo => 
        todo.id === id ? { ...todo, is_completed: !isCompleted } : todo
      ));
    } catch (error) {
      console.error('Error updating todo:', error);
      toast({
        title: "Error",
        description: t("todos.error_update"),
        variant: "destructive",
      });
    }
  };

  const deleteTodo = async (id: string) => {
    try {
      const { error } = await supabase
        .from('todos')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setTodos(prev => prev.filter(todo => todo.id !== id));
      
      toast({
        title: "Success",
        description: t("todos.todo_deleted"),
      });
    } catch (error) {
      console.error('Error deleting todo:', error);
      toast({
        title: "Error",
        description: t("todos.error_delete"),
        variant: "destructive",
      });
    }
  };

  const startEditing = (todo: Todo) => {
    setEditingTodoId(todo.id);
    setEditContent(todo.content);
  };

  const saveEdit = async () => {
    if (!editContent.trim() || !editingTodoId) return;

    try {
      const { error } = await supabase
        .from('todos')
        .update({ content: editContent.trim() })
        .eq('id', editingTodoId);

      if (error) throw error;
      
      setTodos(prev => prev.map(todo => 
        todo.id === editingTodoId ? { ...todo, content: editContent.trim() } : todo
      ));
      
      setEditingTodoId(null);
      setEditContent('');
      
      toast({
        title: "Success",
        description: t("todos.todo_updated"),
      });
    } catch (error) {
      console.error('Error updating todo:', error);
      toast({
        title: "Error",
        description: t("todos.error_update"),
        variant: "destructive",
      });
    }
  };

  const cancelEdit = () => {
    setEditingTodoId(null);
    setEditContent('');
  };

  const completedCount = todos.filter(todo => todo.is_completed).length;
  const totalCount = todos.length;
  const progressPercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("todos.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">{t("todos.loading")}</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          {t("todos.title")} {totalCount > 0 && `(${completedCount}/${totalCount})`}
        </CardTitle>
        {totalCount > 0 && (
          <div className="mt-3">
            <ProgressBar
              value={progressPercentage}
              total={totalCount}
              completed={completedCount}
              className="w-full"
              size="sm"
            />
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {/* Add Todo Input */}
        {isAddingTodo ? (
          <div className="flex items-center gap-2 p-3 border rounded-lg bg-muted/50">
            <Input
              value={newTodoContent}
              onChange={(e) => setNewTodoContent(e.target.value)}
              placeholder={t("todos.enter_todo")}
              className="flex-1"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  addTodo();
                } else if (e.key === 'Escape') {
                  setIsAddingTodo(false);
                  setNewTodoContent('');
                }
              }}
              onBlur={() => {
                if (!newTodoContent.trim()) {
                  setIsAddingTodo(false);
                  setNewTodoContent('');
                }
              }}
            />
            <Button
              size="sm"
              onClick={addTodo}
              disabled={!newTodoContent.trim()}
            >
              <Check className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <button
            onClick={() => setIsAddingTodo(true)}
            className="flex items-center gap-2 w-full p-3 text-left text-muted-foreground hover:bg-muted/50 rounded-lg border border-dashed transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>{t("todos.add_todo")}</span>
          </button>
        )}

        {/* Todo List */}
        {todos.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-4">
            {t("todos.no_todos")}
          </div>
        ) : (
          <div className="space-y-1">
            {todos.map((todo) => (
              <div
                key={todo.id}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-colors hover:bg-muted/30 ${
                  todo.is_completed ? 'bg-green-50' : ''
                }`}
              >
                <Checkbox
                  checked={todo.is_completed}
                  onCheckedChange={() => toggleTodo(todo.id, todo.is_completed)}
                />
                
                {editingTodoId === todo.id ? (
                  <div className="flex items-center gap-2 flex-1">
                    <Input
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="flex-1"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          saveEdit();
                        } else if (e.key === 'Escape') {
                          cancelEdit();
                        }
                      }}
                      onBlur={saveEdit}
                    />
                    <Button
                      size="sm"
                      onClick={saveEdit}
                      disabled={!editContent.trim()}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <span
                    className={`flex-1 cursor-pointer ${
                      todo.is_completed
                        ? 'line-through text-muted-foreground'
                        : ''
                    }`}
                    onClick={() => startEditing(todo)}
                  >
                    {todo.content}
                  </span>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteTodo(todo.id)}
                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};