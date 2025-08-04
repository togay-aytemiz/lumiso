import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ChevronRight, Trash2 } from "lucide-react";
import { format } from "date-fns";

interface Project {
  id: string;
  name: string;
  description: string | null;
  lead_id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

interface ProjectCardProps {
  project: Project;
  onView: (project: Project) => void;
  onDelete: (project: Project) => void;
}

export function ProjectCard({ project, onView, onDelete }: ProjectCardProps) {
  return (
    <Card className="w-full hover:shadow-md transition-shadow cursor-pointer">
      <CardContent className="p-4">
        <div 
          className="flex items-start justify-between"
          onClick={() => onView(project)}
        >
          <div className="flex-1">
            <h3 className="font-bold text-lg mb-1">{project.name}</h3>
            {project.description && (
              <p className="text-muted-foreground mb-2">{project.description}</p>
            )}
            <p className="text-sm text-muted-foreground">
              Created {format(new Date(project.created_at), "MMM d, yyyy")}
            </p>
          </div>
          <div className="flex items-center space-x-2 ml-4">
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(project);
                    }}
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Delete Project</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}