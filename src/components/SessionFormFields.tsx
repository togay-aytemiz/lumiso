import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Project {
  id: string;
  name: string;
}

interface SessionFormFieldsProps {
  leadName: string;
  projectName?: string;
  sessionName: string;
  location: string;
  notes: string;
  projectId?: string;
  showProjectSelector?: boolean;
  availableProjects?: Project[];
  onSessionNameChange: (value: string) => void;
  onLocationChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onProjectChange?: (value: string) => void;
}

export function SessionFormFields({
  leadName,
  projectName,
  sessionName,
  location,
  notes,
  projectId,
  showProjectSelector = false,
  availableProjects = [],
  onSessionNameChange,
  onLocationChange,
  onNotesChange,
  onProjectChange
}: SessionFormFieldsProps) {
  return (
    <div className="space-y-4">
      {/* Client Field */}
      <div className="space-y-2">
        <Label htmlFor="client">Client</Label>
        <Input
          id="client"
          value={leadName}
          disabled
          className="bg-muted"
        />
      </div>

      {/* Project Field - Either Fixed or Selector */}
      {projectName && !showProjectSelector ? (
        <div className="space-y-2">
          <Label htmlFor="project">Project</Label>
          <Input
            id="project"
            value={projectName}
            disabled
            className="bg-muted"
          />
        </div>
      ) : showProjectSelector && onProjectChange ? (
        <div className="space-y-2">
          <Label htmlFor="project">Project (Optional)</Label>
          <Select 
            value={projectId || ""} 
            onValueChange={onProjectChange} 
            disabled={availableProjects.length === 0}
          >
            <SelectTrigger>
              <SelectValue placeholder={availableProjects.length === 0 ? "No projects created yet" : "Select a project"} />
            </SelectTrigger>
            <SelectContent>
              {availableProjects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {/* Session Name Field */}
      <div className="space-y-2">
        <Label htmlFor="session_name">Session Name *</Label>
        <Input
          id="session_name"
          value={sessionName}
          onChange={(e) => onSessionNameChange(e.target.value)}
          placeholder="Enter session name..."
        />
      </div>

      {/* Location Field */}
      <div className="space-y-2">
        <Label htmlFor="location">Location / Address</Label>
        <Textarea
          id="location"
          value={location}
          onChange={(e) => onLocationChange(e.target.value)}
          placeholder="Enter session location or address..."
          rows={2}
        />
      </div>

      {/* Notes Field */}
      <div className="space-y-2">
        <Label htmlFor="notes">Session Notes (Optional)</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="Any special requirements or notes for this session..."
          rows={3}
        />
      </div>
    </div>
  );
}