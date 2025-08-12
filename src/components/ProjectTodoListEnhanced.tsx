import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CheckSquare, Trash2, Plus, Edit, Check, X } from "lucide-react";
import { ProgressBar } from "@/components/ui/progress-bar";

interface Todo {
  id: string;
  content: string;
  is_completed: boolean;
  created_at: string;
}

interface ProjectTodoListEnhancedProps {
  projectId: string;
}

export function ProjectTodoListEnhanced({ projectId }: ProjectTodoListEnhancedProps) {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTodoContent, setNewTodoContent] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    fetchTodos();
  }, [projectId]);

  const fetchTodos = async () => {
    try {
      const { data, error } = await supabase
        .from('todos')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTodos(data || []);
    } catch (error: any) {
      console.error('Error fetching todos:', error);
      toast({
        title: "Error loading todos",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleComplete = async (todoId: string, isCompleted: boolean) => {
    try {
      const { error } = await supabase
        .from('todos')
        .update({ is_completed: !isCompleted })
        .eq('id', todoId);

      if (error) throw error;

      setTodos(todos.map(todo => 
        todo.id === todoId ? { ...todo, is_completed: !isCompleted } : todo
      ));

      toast({
        title: "Success",
        description: `Todo ${!isCompleted ? 'completed' : 'reopened'} successfully.`
      });
    } catch (error: any) {
      toast({
        title: "Error updating todo",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleAddTodo = async () => {
    if (!newTodoContent.trim()) return;

    setIsAdding(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('todos')
        .insert({
          user_id: user.id,
          project_id: projectId,
          content: newTodoContent.trim()
        })
        .select('*')
        .single();

      if (error) throw error;

      setTodos([data, ...todos]);
      setNewTodoContent("");
      
      toast({
        title: "Success",
        description: "Todo added successfully."
      });
    } catch (error: any) {
      toast({
        title: "Error adding todo",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsAdding(false);
    }
  };

  const handleEditTodo = async (todoId: string, newContent: string) => {
    if (!newContent.trim()) return;

    try {
      const { error } = await supabase
        .from('todos')
        .update({ content: newContent.trim() })
        .eq('id', todoId);

      if (error) throw error;

      setTodos(todos.map(todo => 
        todo.id === todoId ? { ...todo, content: newContent.trim() } : todo
      ));

      setEditingId(null);
      setEditContent("");
      
      toast({
        title: "Success",
        description: "Todo updated successfully."
      });
    } catch (error: any) {
      toast({
        title: "Error updating todo",
        description: error.message,
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
      const { error } = await supabase
        .from('todos')
        .delete()
        .eq('id', todoId);

      if (error) throw error;

      setTodos(todos.filter(todo => todo.id !== todoId));
      
      toast({
        title: "Success",
        description: "Todo deleted successfully."
      });
    } catch (error: any) {
      toast({
        title: "Error deleting todo",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg font-medium">
          <CheckSquare className="h-4 w-4" />
          Todos
        </CardTitle>
      </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="w-full h-4 bg-muted animate-pulse rounded" />
            <div className="w-3/4 h-4 bg-muted animate-pulse rounded" />
            <div className="w-1/2 h-4 bg-muted animate-pulse rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const completedCount = todos.filter(todo => todo.is_completed).length;
  const totalCount = todos.length;
  const progressPercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg font-medium">
          <CheckSquare className="h-4 w-4" />
          Todos
        </CardTitle>
        {todos.length > 0 && (
          <div className="pt-2">
            <ProgressBar
              value={progressPercentage}
              total={totalCount}
              completed={completedCount}
              size="md"
            />
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add Todo Input */}
        <div className="flex gap-2">
          <Input
            placeholder="Add a new todo..."
            value={newTodoContent}
            onChange={(e) => setNewTodoContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleAddTodo();
              }
            }}
            className="flex-1"
          />
          <Button 
            onClick={handleAddTodo}
            disabled={!newTodoContent.trim() || isAdding}
            size="sm"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {todos.length > 0 ? (
          <>
            <div className="space-y-3">
              {todos.map((todo) => (
                <div
                  key={todo.id}
                  className="flex items-center gap-2 p-2 bg-muted/30 rounded-md border"
                >
                  <Checkbox
                    checked={todo.is_completed}
                    onCheckedChange={() => handleToggleComplete(todo.id, todo.is_completed)}
                  />
                  <div className="flex-1 min-w-0">
                    {editingId === todo.id ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleEditTodo(todo.id, editContent);
                            } else if (e.key === 'Escape') {
                              cancelEditing();
                            }
                          }}
                          className="flex-1"
                          autoFocus
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditTodo(todo.id, editContent)}
                          className="h-8 w-8 p-0 text-green-600 hover:text-green-700"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={cancelEditing}
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <p className={`text-sm ${todo.is_completed ? 'line-through text-muted-foreground' : ''}`}>
                        {todo.content}
                      </p>
                    )}
                  </div>
                  {editingId !== todo.id && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => startEditing(todo)}
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteTodo(todo.id)}
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-6">
            <CheckSquare className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground text-sm">No todos yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Add your first todo above
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}