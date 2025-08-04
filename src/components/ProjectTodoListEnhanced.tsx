import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CheckSquare, Trash2 } from "lucide-react";
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
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckSquare className="h-5 w-5" />
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
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckSquare className="h-5 w-5" />
          Todos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {todos.length > 0 ? (
          <>
            <div className="space-y-3">
              {todos.map((todo) => (
                <div
                  key={todo.id}
                  className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg border"
                >
                  <Checkbox
                    checked={todo.is_completed}
                    onCheckedChange={() => handleToggleComplete(todo.id, todo.is_completed)}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${todo.is_completed ? 'line-through text-muted-foreground' : ''}`}>
                      {todo.content}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteTodo(todo.id)}
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="pt-2">
              <ProgressBar
                value={progressPercentage}
                total={totalCount}
                completed={completedCount}
                size="md"
              />
            </div>
          </>
        ) : (
          <div className="text-center py-6">
            <CheckSquare className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground text-sm">No todos yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Use the Todo tab above to add tasks
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}