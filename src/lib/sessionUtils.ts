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