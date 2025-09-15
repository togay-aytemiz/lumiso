interface SessionForDisplay {
  session_name?: string | null;
  projects?: {
    name?: string;
    project_types?: {
      name?: string;
    };
  } | null;
  leads?: {
    name?: string;
  } | null;
}

/**
 * Gets the display name for a session with consistent priority:
 * 1. Existing session_name if available
 * 2. Project type + "Session" 
 * 3. Lead name + "Session"
 * 4. "Session" as fallback
 */
export const getDisplaySessionName = (session: SessionForDisplay): string => {
  if (!session) return "Session";
  
  // Priority 1: Use existing session name if available
  if (session.session_name?.trim()) {
    return session.session_name.trim();
  }
  
  // Priority 2: Use project type if available
  if (session.projects?.project_types?.name) {
    return `${session.projects.project_types.name} Session`;
  }
  
  // Priority 3: Use lead name if available
  if (session.leads?.name) {
    return `${session.leads.name} Session`;
  }
  
  // Fallback
  return "Session";
};

/**
 * Generates a session name based on project information
 */
export const generateSessionName = (projectName: string): string => {
  if (!projectName?.trim()) {
    return "New Session";
  }
  
  // Clean up the project name and add "Session"
  const cleanProjectName = projectName.trim();
  return `${cleanProjectName} Session`;
};