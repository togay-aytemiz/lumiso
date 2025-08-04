import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ChevronRight } from "lucide-react";
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
}

export function ProjectCard({ project, onView }: ProjectCardProps) {
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
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>Created {format(new Date(project.created_at), "M/d/yy")}</span>
              {project.updated_at !== project.created_at && (
                <span>Updated {format(new Date(project.updated_at), "M/d/yy")}</span>
              )}
            </div>
          </div>
          <div className="flex items-center ml-4">
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}