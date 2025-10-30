import { useContext } from "react";
import { ProjectCreationContext } from "../context/ProjectCreationProvider";

export const useProjectCreationContext = () => {
  const context = useContext(ProjectCreationContext);
  if (!context) {
    throw new Error("useProjectCreationContext must be used within a ProjectCreationProvider");
  }
  return context;
};
